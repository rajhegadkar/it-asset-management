import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

export class BarcodeGenerator {
  /**
   * Generate Barcode as Base64 Data URL (Code128 or Code39)
   */
  static async generateBarcodeBase64(
    text: string,
    bcid: 'code128' | 'code39' = 'code128',
    options?: { height?: number; scale?: number; includetext?: boolean }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: bcid,
          text: text,
          scale: options?.scale || 3,
          height: options?.height || 10,
          includetext: options?.includetext !== false,
          textxalign: 'center',
        },
        (err, png) => {
          if (err) {
            reject(err);
          } else {
            resolve(`data:image/png;base64,${png.toString('base64')}`);
          }
        }
      );
    });
  }

  /**
   * Generate Barcode Buffer
   */
  static async generateBarcodeBuffer(
    text: string,
    bcid: 'code128' | 'code39' = 'code128',
    options?: { height?: number; scale?: number; includetext?: boolean }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid,
          text,
          scale: options?.scale || 3,
          height: options?.height || 10,
          includetext: options?.includetext !== undefined ? options.includetext : true,
          textxalign: 'center',
        },
        (err, png) => {
          if (err) reject(err);
          else resolve(png);
        }
      );
    });
  }

  /**
   * Generate QR Code as Base64 Data URL
   */
  static async generateQrCodeBase64(text: string): Promise<string> {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 250,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
  }

  /**
   * Generate QR Code as Buffer
   */
  static async generateQrCodeBuffer(text: string): Promise<Buffer> {
    return await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 250,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
  }
}
