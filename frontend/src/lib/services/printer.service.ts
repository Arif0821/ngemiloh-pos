export class PrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connectAndPrint(receiptData: string) {
    try {
      if (!this.device || !this.device.gatt?.connected) {
        // Request bluetooth device. Filtering by common ESC/POS generic thermal printer UUIDs
        this.device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Generic thermal printer service UUID
            { namePrefix: 'MPT' },
            { namePrefix: 'Blue' },
            { namePrefix: 'Inner' }
          ],
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Needs to match typical BLE printer
        });
        
        const server = await this.device.gatt?.connect();
        if (!server) throw new Error("Failed to connect to GATT server");

        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      }

      if (!this.characteristic) throw new Error("Characteristic not found");

      // Generate ESC/POS commands
      // ESC @ (Initialize printer)
      const encoder = new TextEncoder();
      const escPosCommands = new Uint8Array([
        0x1b, 0x40, // Init
        ...encoder.encode(receiptData),
        0x0a, 0x0a, 0x0a, // Feed lines
        0x1d, 0x56, 0x41, 0x00 // Cut paper
      ]);

      // Write in chunks of 512 bytes max to BLE
      const chunkSize = 512;
      for (let i = 0; i < escPosCommands.length; i += chunkSize) {
        const chunk = escPosCommands.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
      }
      
      console.log('Receipt printed successfully');
      return true;

    } catch (e: any) {
      console.error('Bluetooth printing error', e);
      // alert('Gagal mencetak struk via Bluetooth: ' + e.message);
      return false;
    }
  }

  // Utility to format standard receipts
  formatReceipt(order: any, storeName: string, footer: string) {
    let text = `\n${storeName}\n`;
    text += `================================\n`;
    text += `ID: ${order.client_uuid.split('-')[0].toUpperCase()}\n`;
    text += `Tanggal: ${new Date().toLocaleString('id-ID')}\n`;
    text += `================================\n`;
    
    for (const item of order.items) {
      let itemName = (item.product?.name || 'Produk') + ' x' + item.quantity;
      text += `${itemName.padEnd(20)} ${item.subtotal.toString().padStart(11)}\n`;
    }
    
    text += `--------------------------------\n`;
    text += `TOTAL: Rp ${order.client_final_price}\n`;
    text += `================================\n`;
    text += `${footer}\n`;
    return text;
  }
}

export const printerService = new PrinterService();
