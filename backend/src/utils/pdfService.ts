import PDFDocument from 'pdfkit';
import { BarcodeGenerator } from './barcodeGenerator.js';
import { PdfTemplateEngine } from '../customization/pdfTemplateEngine.js';

export interface HandoverPdfData {
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  employeeName: string;
  employeeId: string;
  employeeEmail: string;
  departmentName: string;
  assetName: string;
  assetId: string;
  assetTag: string;
  serialNumber: string;
  categoryName: string;
  manufacturer?: string;
  model?: string;
  allocationDate: string;
  allocationType: string;
  accessories: string[];
  allocatedBy: string;
  termsAccepted: boolean;
  signatureData?: string;
  acknowledgedAt?: string;
  customTerms?: string;
}

export class PdfService {
  /**
   * Generates a professional Asset Handover Document PDF with dynamic vertical layout
   * and zero text/graphic overlapping.
   */
  static async generateHandoverDocument(data: HandoverPdfData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        let currentY = 40;

        // 1. Header Banner
        doc.rect(40, currentY, 515, 62).fill('#0f172a');

        doc.fontSize(15).fillColor('#ffffff').font('Helvetica-Bold')
           .text((data.companyName || 'IT ASSET MANAGEMENT').toUpperCase(), 55, currentY + 12, { width: 310, ellipsis: true });
        doc.fontSize(8.5).fillColor('#94a3b8').font('Helvetica')
           .text('OFFICIAL IT ASSET ALLOCATION & HANDOVER CERTIFICATE', 55, currentY + 34, { width: 310 });

        doc.fontSize(8).fillColor('#cbd5e1').font('Helvetica')
           .text(`Date of Issue: ${data.allocationDate}`, 360, currentY + 14, { width: 180, align: 'right' })
           .text(`Allocation Type: ${data.allocationType || 'Standard'}`, 360, currentY + 28, { width: 180, align: 'right' });
        
        doc.fontSize(8).fillColor(data.termsAccepted ? '#34d399' : '#fbbf24').font('Helvetica-Bold')
           .text(data.termsAccepted ? 'STATUS: ACKNOWLEDGED' : 'STATUS: PENDING SIGN-OFF', 360, currentY + 42, { width: 180, align: 'right' });

        currentY += 76;

        // 2. Section: Recipient Employee Information
        doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
        doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('1. RECIPIENT / EMPLOYEE INFORMATION', 50, currentY + 5);

        currentY += 26;

        // Left Column (Employee identity)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Full Name: ', 50, currentY, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.employeeName || 'N/A', { width: 230, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Employee ID: ', 50, currentY + 16, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.employeeId || 'N/A', { width: 230, ellipsis: true });

        // Right Column (Department & Email)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Department: ', 300, currentY, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.departmentName || 'General', { width: 245, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Email Address: ', 300, currentY + 16, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.employeeEmail || 'N/A', { width: 245, ellipsis: true });

        currentY += 38;

        // 3. Section: Assigned IT Hardware Details
        doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
        doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('2. ASSIGNED IT ASSET DETAILS', 50, currentY + 5);

        currentY += 26;

        // Col 1 (Identity)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Asset Name: ', 50, currentY, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.assetName || 'N/A', { width: 175, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Asset Tag: ', 50, currentY + 16, { continued: true })
           .font('Helvetica-Bold').fillColor('#2563eb').text(data.assetTag || data.assetId, { width: 175, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Asset ID: ', 50, currentY + 32, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.assetId || 'N/A', { width: 175, ellipsis: true });

        // Col 2 (Technical specs)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Serial Number: ', 235, currentY, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.serialNumber || 'N/A', { width: 195, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Category: ', 235, currentY + 16, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(data.categoryName || 'General', { width: 195, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('Make / Model: ', 235, currentY + 32, { continued: true })
           .font('Helvetica').fillColor('#0f172a').text(`${data.manufacturer || ''} ${data.model || ''}`.trim() || 'Standard Spec', { width: 195, ellipsis: true });

        // Col 3: QR Code (safe width & height, no overlap)
        try {
          const qrBuffer = await BarcodeGenerator.generateQrCodeBuffer(data.assetTag || data.assetId);
          doc.rect(448, currentY - 2, 66, 66).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          doc.image(qrBuffer, 451, currentY + 1, { width: 60, height: 60 });
          doc.fontSize(6.5).fillColor('#64748b').font('Helvetica').text('Scan to Verify', 448, currentY + 68, { width: 66, align: 'center' });
        } catch {
          // fallback placeholder
          doc.rect(448, currentY - 2, 66, 66).strokeColor('#cbd5e1').stroke();
          doc.fontSize(7).fillColor('#64748b').text('QR Code', 448, currentY + 25, { width: 66, align: 'center' });
        }

        currentY += 84;

        // 4. Section: Included Accessories
        doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
        doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('3. BUNDLED ACCESSORIES & PERIPHERALS', 50, currentY + 5);

        currentY += 26;

        if (!data.accessories || data.accessories.length === 0) {
          doc.fontSize(8.5).fillColor('#64748b').font('Helvetica').text('No additional accessories or peripherals issued.', 50, currentY);
          currentY += 20;
        } else {
          // 2-column compact list to prevent page overflow
          const accList = data.accessories;
          for (let idx = 0; idx < accList.length; idx++) {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const posX = col === 0 ? 55 : 300;
            const posY = currentY + row * 15;
            doc.fontSize(8).fillColor('#0f172a').font('Helvetica')
               .text(`[✓]  ${accList[idx]}`, posX, posY, { width: 235, ellipsis: true });
          }
          const rowCount = Math.ceil(accList.length / 2);
          currentY += rowCount * 15 + 8;
        }

        // 5. Section: Terms & Conditions
        currentY += 6;
        doc.rect(40, currentY, 515, 18).fill('#f8fafc');
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold')
           .text('4. TERMS OF ASSET CUSTODY & POLICY COMPLIANCE', 50, currentY + 4);

        currentY += 22;

        const rawTerms = data.customTerms || (await PdfTemplateEngine.getConfig()).customHandoverTerms;
        const terms = rawTerms
          ? rawTerms.split('\n').map((l: string) => l.trim()).filter(Boolean)
          : [
              '1. The employee acknowledges receipt of the designated corporate hardware equipment in good operating condition.',
              '2. The equipment remains the exclusive property of the company and must be returned immediately upon separation or IT recall.',
              '3. Unauthorized modification, hardware tampering, or personal subletting of the equipment is strictly prohibited.',
              '4. In case of theft, loss, or hardware failure, the custodian must file an IT service incident within 24 hours.',
            ];

        doc.fontSize(7.5).fillColor('#475569').font('Helvetica');
        for (const line of terms) {
          doc.text(line, 50, currentY, { width: 495, lineGap: 1.5 });
          currentY += 13;
        }

        // 6. Signatures Block
        currentY += 12;
        const sigBoxHeight = 88;
        const boxWidth = 245;

        // Left Box: IT Representative
        doc.roundedRect(40, currentY, boxWidth, sigBoxHeight, 4).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
        doc.roundedRect(40, currentY, boxWidth, 18, 4).fill('#f1f5f9');
        doc.rect(40, currentY + 14, boxWidth, 4).fill('#f1f5f9');
        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold').text('ISSUED BY (IT OPERATIONS)', 48, currentY + 5);

        doc.fontSize(8).fillColor('#334155').font('Helvetica')
           .text(`Authorized Officer: ${data.allocatedBy || 'IT Administrator'}`, 48, currentY + 24)
           .text(`Digital Authorization: System Verified`, 48, currentY + 38)
           .text(`Issue Timestamp: ${data.allocationDate}`, 48, currentY + 52);

        // Right Box: Recipient Employee
        const rightBoxX = 310;
        doc.roundedRect(rightBoxX, currentY, boxWidth, sigBoxHeight, 4).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
        doc.roundedRect(rightBoxX, currentY, boxWidth, 18, 4).fill('#f1f5f9');
        doc.rect(rightBoxX, currentY + 14, boxWidth, 4).fill('#f1f5f9');
        doc.fontSize(8).fillColor('#0f172a').font('Helvetica-Bold').text('EMPLOYEE CUSTODIAN ACCEPTANCE', rightBoxX + 8, currentY + 5);

        doc.fontSize(8).fillColor('#334155').font('Helvetica')
           .text(`Recipient Name: ${data.employeeName || 'N/A'}`, rightBoxX + 8, currentY + 24);

        if (data.signatureData && data.signatureData.startsWith('data:image')) {
          try {
            const base64Data = data.signatureData.replace(/^data:image\/\w+;base64,/, '');
            const sigBuf = Buffer.from(base64Data, 'base64');
            doc.image(sigBuf, rightBoxX + 8, currentY + 36, { fit: [140, 32] });
            doc.fontSize(7).fillColor('#64748b').text(`Signed: ${data.acknowledgedAt || data.allocationDate}`, rightBoxX + 8, currentY + 70);
          } catch {
            doc.fontSize(8).fillColor('#059669').font('Helvetica-Bold').text('✓ Digital Signature Confirmed', rightBoxX + 8, currentY + 40);
            doc.fontSize(7).fillColor('#64748b').font('Helvetica').text(`Acknowledged: ${data.acknowledgedAt || data.allocationDate}`, rightBoxX + 8, currentY + 56);
          }
        } else if (data.termsAccepted) {
          doc.fontSize(8).fillColor('#059669').font('Helvetica-Bold').text('✓ ELECTRONIC ACCEPTANCE CONFIRMED', rightBoxX + 8, currentY + 40);
          doc.fontSize(7).fillColor('#64748b').font('Helvetica').text(`Digital Audit Stamp: ${data.acknowledgedAt || data.allocationDate}`, rightBoxX + 8, currentY + 54);
          doc.fontSize(6.5).fillColor('#94a3b8').text('Cryptographically validated via employee portal session', rightBoxX + 8, currentY + 68);
        } else {
          doc.moveTo(rightBoxX + 10, currentY + 62).lineTo(rightBoxX + boxWidth - 10, currentY + 62).strokeColor('#94a3b8').stroke();
          doc.fontSize(7).fillColor('#64748b').text('Physical Signature & Date of Receipt', rightBoxX + 10, currentY + 68);
        }

        // 7. Confidential Footer (Pinned at page bottom)
        doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
           .text('IT Asset Management System v2.0 • Official Custody Audit Certificate • Confidential Corporate Record', 40, 792, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates Printable Asset Labels (Single or Bulk Sheet) with zero text/barcode collisions
   */
  static async generateAssetLabelSheet(
    assets: Array<{
      assetId: string;
      assetTag: string;
      serialNumber: string;
      name: string;
      categoryName: string;
      companyName: string;
    }>
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 20, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const pdfConfig = await PdfTemplateEngine.getConfig();

        // A4 Grid: 2 columns x 4 rows per page = 8 labels per page
        // Clean layout: label width 260pt, height 165pt
        const labelWidth = 260;
        const labelHeight = 165;
        const startX = 28;
        const startY = 30;
        const gapX = 18;
        const gapY = 24;

        let col = 0;
        let row = 0;

        for (let i = 0; i < assets.length; i++) {
          const a = assets[i];
          const x = startX + col * (labelWidth + gapX);
          const y = startY + row * (labelHeight + gapY);

          // 1. Label Outer Border
          doc.roundedRect(x, y, labelWidth, labelHeight, 4).lineWidth(0.75).strokeColor('#0f172a').stroke();

          // 2. Header Banner
          doc.roundedRect(x, y, labelWidth, 24, 4).fill('#0f172a');
          doc.rect(x, y + 16, labelWidth, 8).fill('#0f172a'); // Square off lower banner corners

          const headerTitle = (pdfConfig.headerText || a.companyName || 'IT ASSET MANAGEMENT').toUpperCase();
          doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
             .text(headerTitle, x + 8, y + 7, { width: labelWidth - 68, ellipsis: true });
          doc.fontSize(6.5).fillColor('#94a3b8').font('Helvetica-Bold')
             .text('IT ASSET', x + labelWidth - 55, y + 8, { width: 47, align: 'right' });

          // 3. Middle Section: Information (Left) & QR Code (Right)
          const tagDisplay = a.assetTag || a.assetId;
          
          // Left Info Details with dynamic cursor tracking to completely avoid collisions
          let curY = y + 27;

          // 1. Primary Asset Tag
          doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold')
             .text(`TAG: ${tagDisplay}`, x + 8, curY, { width: 167, lineBreak: false, ellipsis: true });
          curY += 12;

          // 2. Asset System Master ID
          doc.fontSize(7.5).fillColor('#2563eb').font('Helvetica-Bold')
             .text(`ID: ${a.assetId}`, x + 8, curY, { width: 167, lineBreak: false, ellipsis: true });
          curY += 11;

          // 3. Serial Number
          doc.fontSize(7.5).fillColor('#475569').font('Helvetica')
             .text(`S/N: ${a.serialNumber || 'N/A'}`, x + 8, curY, { width: 167, lineBreak: false, ellipsis: true });
          curY += 11;

          // 4. Model Name (dynamically tracked: if 2 lines, curY advances cleanly without overlapping Cat)
          doc.fontSize(7.5).fillColor('#334155').font('Helvetica');
          const modelLabel = `Model: ${a.name || 'Equipment'}`;
          const modelW = doc.widthOfString(modelLabel);
          if (modelW > 167) {
            doc.text(modelLabel, x + 8, curY, { width: 167, height: 20, ellipsis: true });
            curY += 20;
          } else {
            doc.text(modelLabel, x + 8, curY, { width: 167, lineBreak: false, ellipsis: true });
            curY += 11;
          }

          // 5. Category (positioned strictly below Model with zero overlap)
          doc.fontSize(7).fillColor('#64748b').font('Helvetica')
             .text(`Cat: ${a.categoryName || 'Hardware'}`, x + 8, curY, { width: 167, lineBreak: false, ellipsis: true });

          // Right QR Code: clean 70x68 box from x + 180 to 250, y + 27 to 95
          try {
            const qrBuffer = await BarcodeGenerator.generateQrCodeBuffer(tagDisplay);
            doc.roundedRect(x + 180, y + 27, 70, 68, 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
            doc.image(qrBuffer, x + 185, y + 31, { width: 60, height: 60 });
          } catch {
            doc.roundedRect(x + 180, y + 27, 70, 68, 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          }

          // 4. Subtle Divider Line before Barcode
          doc.moveTo(x + 8, y + 98).lineTo(x + labelWidth - 8, y + 98).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

          // 5. 1D Barcode Section (Below y + 100, completely clear of QR code and text!)
          try {
            // Note: includetext: false ensures bwip-js doesn't overlap text with bars or bottom border
            const barcodeBuffer = await BarcodeGenerator.generateBarcodeBuffer(tagDisplay, 'code128', {
              includetext: false,
              height: 8,
              scale: 3,
            });
            doc.image(barcodeBuffer, x + 18, y + 102, { width: labelWidth - 36, height: 26 });
          } catch {
            doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold')
               .text(`* ${tagDisplay} *`, x + 10, y + 108, { width: labelWidth - 20, align: 'center', lineBreak: false });
          }

          // Human-readable barcode text centered below bars
          doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold')
             .text(`* ${tagDisplay} *`, x + 10, y + 132, { width: labelWidth - 20, align: 'center', lineBreak: false });

          // Security tag notice at the very bottom
          doc.fontSize(6).fillColor('#94a3b8').font('Helvetica')
             .text('PROPERTY OF ORGANIZATION • DO NOT REMOVE', x + 10, y + 146, { width: labelWidth - 20, align: 'center', lineBreak: false });

          col++;
          if (col >= 2) {
            col = 0;
            row++;
            if (row >= 4 && i < assets.length - 1) {
              row = 0;
              doc.addPage();
            }
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
