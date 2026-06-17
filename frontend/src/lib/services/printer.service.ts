import type { OrderResponse } from '../domain/models/types';

// ============================================
// PRINTER SERVICE - Hybrid Printer Support
// Web Bluetooth + HTML Print fallback
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
}

export const printer_service = new PrinterService();
