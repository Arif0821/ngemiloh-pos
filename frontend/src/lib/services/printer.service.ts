import type { OrderResponse } from '../domain/models/types';
import { db, type LocalReceipt } from '../db';

// ============================================
// PRINTER SERVICE - Hybrid Printer Support
// Web Bluetooth + HTML Print fallback + Offline Receipt
// Using snake_case naming convention
// ============================================

// Web Bluetooth API type declarations
declare global {
	interface Navigator {
		bluetooth: Bluetooth;
	}
	interface Bluetooth {
		requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
	}
	interface BluetoothRequestDeviceOptions {
		filters?: BluetoothLEScanFilter[];
		optionalServices?: string[];
	}
	interface BluetoothLEScanFilter {
		services?: string[];
		namePrefix?: string;
	}
	interface BluetoothDevice {
		readonly id: string;
		readonly name?: string;
		readonly gatt?: BluetoothRemoteGATTServer;
	}
	interface BluetoothRemoteGATTServer {
		readonly connected: boolean;
		connect(): Promise<BluetoothRemoteGATTServer>;
		disconnect(): void;
		getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
	}
	interface BluetoothRemoteGATTService {
		getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
	}
	interface BluetoothRemoteGATTCharacteristic {
		readonly uuid: string;
		writeValue(data: BufferSource): Promise<void>;
	}
}

export class PrinterService {
	private device: BluetoothDevice | null = null;
	private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

	/**
	 * Connect to Bluetooth printer and print receipt
	 * @returns true if print successful, false if Bluetooth unavailable/failed
	 */
	async connect_and_print(receipt_data: string): Promise<boolean> {
		try {
			// Check if Web Bluetooth API is available
			if (!navigator.bluetooth) {
				console.warn('Web Bluetooth API not available');
				return false;
			}

			if (!this.device || !this.device.gatt?.connected) {
				// Request Bluetooth device with common thermal printer filters
				this.device = await navigator.bluetooth.requestDevice({
					filters: [
						{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
						{ namePrefix: 'MPT' },
						{ namePrefix: 'Blue' },
						{ namePrefix: 'Inner' }
					],
					optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
				});

				const server = await this.device.gatt?.connect();
				if (!server) throw new Error('Failed to connect to GATT server');

				const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
				this.characteristic = await service.getCharacteristic(
					'00002af1-0000-1000-8000-00805f9b34fb'
				);
			}

			if (!this.characteristic) throw new Error('Characteristic not found');

			// Generate ESC/POS commands
			const encoder = new TextEncoder();
			const esc_pos_commands = new Uint8Array([
				0x1b,
				0x40, // Init
				...encoder.encode(receipt_data),
				0x0a,
				0x0a,
				0x0a, // Feed lines
				0x1d,
				0x56,
				0x41,
				0x00 // Cut paper
			]);

			// Write in chunks of 512 bytes (BLE limitation)
			const chunk_size = 512;
			for (let i = 0; i < esc_pos_commands.length; i += chunk_size) {
				const chunk = esc_pos_commands.slice(i, i + chunk_size);
				await this.characteristic.writeValue(chunk);
			}

			console.log('Receipt printed via Bluetooth');
			return true;
		} catch (e: unknown) {
			const error_message = e instanceof Error ? e.message : String(e);
			console.error('Bluetooth printing error:', error_message);
			return false;
		}
	}

	/**
	 * Format standard receipt text for Bluetooth printing
	 */
	format_receipt(order: OrderResponse, store_name: string, footer: string): string {
		let text = `\n${store_name}\n`;
		text += `================================\n`;
		text += `ID: ${order.client_uuid.split('-')[0].toUpperCase()}\n`;
		text += `Tanggal: ${new Date().toLocaleString('id-ID')}\n`;
		text += `================================\n`;

		const items = order.items || [];
		for (const item of items) {
			const item_name = (item.product_name_snapshot || 'Produk') + ' x' + item.quantity;
			text += `${item_name.padEnd(20)} ${item.subtotal.toString().padStart(11)}\n`;
		}

		text += `--------------------------------\n`;
		text += `TOTAL: Rp ${order.final_price}\n`;
		text += `================================\n`;
		text += `${footer}\n`;
		return text;
	}

	/**
	 * Generate HTML receipt for browser printing
	 */
	generate_html_receipt(order: OrderResponse, store_name: string, footer: string): string {
		const items = order.items || [];
		const items_html = items
			.map(
				(item) => `
				<tr>
					<td>${item.product_name_snapshot || 'Produk'} x${item.quantity}</td>
					<td style="text-align: right;">Rp ${item.subtotal.toLocaleString('id-ID')}</td>
				</tr>
			`
			)
			.join('');

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>Struk - ${order.client_uuid.split('-')[0].toUpperCase()}</title>
				<style>
					body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 10px; }
					h2 { text-align: center; margin: 0; }
					hr { border: 1px dashed #000; margin: 8px 0; }
					table { width: 100%; border-collapse: collapse; }
					.footer { text-align: center; margin-top: 16px; }
					.total { font-weight: bold; font-size: 14px; }
					@media print { body { margin: 0; } }
				</style>
			</head>
			<body>
				<h2>${store_name}</h2>
				<hr>
				<p>ID: ${order.client_uuid.split('-')[0].toUpperCase()}<br>
				Tanggal: ${new Date().toLocaleString('id-ID')}</p>
				<hr>
				<table>${items_html}</table>
				<hr>
				<p class="total">TOTAL: Rp ${order.total_amount?.toLocaleString('id-ID') || order.total_amount}</p>
				<hr>
				<div class="footer">${footer}</div>
			</body>
			</html>
		`;
	}

	/**
	 * Save receipt to IndexedDB for offline printing
	 */
	async save_receipt_for_offline(
		order: OrderResponse,
		receipt_text: string,
		receipt_html: string
	): Promise<void> {
		const receipt: LocalReceipt = {
			id: order.client_uuid,
			order_data: order as unknown as import('../db').LocalOrder,
			receipt_html,
			receipt_text,
			print_status: 'pending',
			created_at: Date.now()
		};
		await db.receipts.put(receipt);
	}

	/**
	 * Print receipt via browser print dialog (HTML)
	 */
	print_html_receipt(html: string): void {
		const print_window = window.open('', '_blank', 'width=300,height=600');
		if (!print_window) {
			console.warn('Failed to open print window - popup blocked');
			toast.error('Popup terblokir. Izinkan popup untuk cetak.');
			return;
		}
		print_window.document.write(html);
		print_window.document.close();
		print_window.onload = () => {
			print_window.print();
		};
	}

	/**
	 * Try to print pending offline receipts
	 * Called when coming back online or when printer becomes available
	 */
	async print_pending_receipts(): Promise<number> {
		const pending = await db.receipts.where('print_status').equals('pending').toArray();
		let printed_count = 0;

		for (const receipt of pending) {
			try {
				// Try Bluetooth first, then HTML fallback
				const bluetooth_success = await this.connect_and_print(receipt.receipt_text);
				if (bluetooth_success) {
					await db.receipts.update(receipt.id, { print_status: 'printed', printed_at: Date.now() });
					printed_count++;
				} else {
					// Fallback to HTML print
					this.print_html_receipt(receipt.receipt_html);
					await db.receipts.update(receipt.id, { print_status: 'printed', printed_at: Date.now() });
					printed_count++;
				}
			} catch (e) {
				console.error('Failed to print receipt:', receipt.id, e);
				await db.receipts.update(receipt.id, { print_status: 'failed' });
			}
		}

		return printed_count;
	}

	/**
	 * Get pending receipts count
	 */
	async get_pending_receipts_count(): Promise<number> {
		return db.receipts.where('print_status').equals('pending').count();
	}
}

export const printer_service = new PrinterService();

// Toast import for error messages
import { toast } from '$lib/stores/toast.store.svelte';
