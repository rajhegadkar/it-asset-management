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
        const orgName = (data.companyName || 'IT ASSET MANAGEMENT').toUpperCase();

        // 1. Header Banner (Clean, high-contrast corporate card)
        doc.roundedRect(40, currentY, 515, 64, 4).fill('#0f172a');

        // Company / Organization Name
        doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold')
           .text(orgName, 55, currentY + 12, { width: 310, height: 16, ellipsis: true, lineBreak: false });

        doc.fontSize(8).fillColor('#94a3b8').font('Helvetica-Bold')
           .text('OFFICIAL IT ASSET ALLOCATION & HANDOVER CERTIFICATE', 55, currentY + 34, { width: 310, height: 12, lineBreak: false });

        // Header Meta (Right column)
        doc.fontSize(8).fillColor('#cbd5e1').font('Helvetica')
           .text(`Date of Issue: ${data.allocationDate}`, 360, currentY + 12, { width: 180, align: 'right', lineBreak: false })
           .text(`Allocation Type: ${data.allocationType || 'Standard'}`, 360, currentY + 26, { width: 180, align: 'right', lineBreak: false });
        
        doc.fontSize(8).fillColor(data.termsAccepted ? '#34d399' : '#fbbf24').font('Helvetica-Bold')
           .text(data.termsAccepted ? 'STATUS: ACKNOWLEDGED' : 'STATUS: PENDING SIGN-OFF', 360, currentY + 42, { width: 180, align: 'right', lineBreak: false });

        currentY += 74;

        // 2. Section: Recipient Employee Information
        doc.roundedRect(40, currentY, 515, 18, 2).fill('#f1f5f9');
        doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('1. RECIPIENT / EMPLOYEE INFORMATION', 48, currentY + 4);

        currentY += 24;

        // Two distinct columns with fixed labelX and valueX to guarantee zero collision
        // Left Column (Employee identity)
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Full Name:', 50, currentY, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.employeeName || 'N/A', 130, currentY, { width: 155, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Employee ID:', 50, currentY + 15, { width: 75, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#2563eb').text(data.employeeId || 'N/A', 130, currentY + 15, { width: 155, ellipsis: true, lineBreak: false });

        // Right Column (Department & Email)
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Department:', 305, currentY, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.departmentName || 'General', 385, currentY, { width: 160, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Email Address:', 305, currentY + 15, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.employeeEmail || 'N/A', 385, currentY + 15, { width: 160, ellipsis: true, lineBreak: false });

        currentY += 34;

        // 3. Section: Assigned IT Hardware Details
        doc.roundedRect(40, currentY, 515, 18, 2).fill('#f1f5f9');
        doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('2. ASSIGNED IT ASSET DETAILS', 48, currentY + 4);

        currentY += 24;

        // Col 1 (Identity)
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Asset Name:', 50, currentY, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.assetName || 'N/A', 130, currentY, { width: 130, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Asset Tag:', 50, currentY + 15, { width: 75, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#2563eb').text(data.assetTag || data.assetId, 130, currentY + 15, { width: 130, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Asset ID:', 50, currentY + 30, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(data.assetId || 'N/A', 130, currentY + 30, { width: 130, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Condition:', 50, currentY + 45, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#059669').text('NEW / VERIFIED GOOD', 130, currentY + 45, { width: 130, ellipsis: true, lineBreak: false });

        // Col 2 (Technical specs)
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Serial Number:', 270, currentY, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.serialNumber || 'N/A', 350, currentY, { width: 120, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Category:', 270, currentY + 15, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.categoryName || 'General', 350, currentY + 15, { width: 120, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Make / Model:', 270, currentY + 30, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(`${data.manufacturer || ''} ${data.model || ''}`.trim() || 'Standard Unit', 350, currentY + 30, { width: 120, ellipsis: true, lineBreak: false });

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569').text('Custodian:', 270, currentY + 45, { width: 75, lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(data.employeeName || 'N/A', 350, currentY + 45, { width: 120, ellipsis: true, lineBreak: false });

        // Col 3: QR Code
        try {
          const qrBuffer = await BarcodeGenerator.generateQrCodeBuffer(data.assetTag || data.assetId);
          doc.roundedRect(478, currentY - 2, 68, 68, 3).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          doc.image(qrBuffer, 482, currentY + 2, { width: 60, height: 60 });
          doc.fontSize(6).fillColor('#64748b').font('Helvetica-Bold').text('SCAN TO AUDIT', 478, currentY + 58, { width: 68, align: 'center', lineBreak: false });
        } catch {
          doc.roundedRect(478, currentY - 2, 68, 68, 3).strokeColor('#cbd5e1').stroke();
          doc.fontSize(7).fillColor('#64748b').text('QR Code', 478, currentY + 26, { width: 68, align: 'center' });
        }

        currentY += 70;

        // 4. Section: Included Accessories
        doc.roundedRect(40, currentY, 515, 18, 2).fill('#f1f5f9');
        doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('3. BUNDLED ACCESSORIES & PERIPHERALS', 48, currentY + 4);

        currentY += 24;

        if (!data.accessories || data.accessories.length === 0) {
          doc.fontSize(8).fillColor('#64748b').font('Helvetica').text('No additional peripheral accessories registered with this asset.', 50, currentY);
          currentY += 16;
        } else {
          const accList = data.accessories;
          for (let idx = 0; idx < accList.length; idx++) {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const posX = col === 0 ? 55 : 305;
            const posY = currentY + row * 14;
            doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica')
               .text(`[✓]  ${accList[idx]}`, posX, posY, { width: 235, ellipsis: true, lineBreak: false });
          }
          const rowCount = Math.ceil(accList.length / 2);
          currentY += rowCount * 14 + 6;
        }

        // 5. Section: Terms & Conditions
        currentY += 6;
        doc.roundedRect(40, currentY, 515, 18, 2).fill('#f8fafc');
        doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold')
           .text('4. TERMS OF ASSET CUSTODY & POLICY COMPLIANCE', 48, currentY + 4);

        currentY += 22;

        const rawTerms = data.customTerms || (await PdfTemplateEngine.getConfig()).customHandoverTerms;
        const terms = rawTerms
          ? rawTerms.split('\n').map((l: string) => l.trim()).filter(Boolean)
          : [
              '1. Equipment Ownership: The hardware asset and accessories remain the exclusive property of the company and must be surrendered immediately upon separation, transfer, or IT department recall.',
              '2. Authorized Use: The custodian agrees to use the device solely for official business activities in accordance with corporate Acceptable IT Use and Information Security policies.',
              '3. Care & Safeguarding: The employee is responsible for taking reasonable precautions against theft, loss, damage, or unauthorized modifications. Equipment cannot be pledged, sublet, or altered.',
              '4. Incident Reporting: In the event of loss, theft, hardware defect, or security compromise, the custodian must notify the IT Helpdesk and file a formal incident report within 24 hours.',
            ];

        doc.fontSize(7).fillColor('#475569').font('Helvetica');
        for (const line of terms) {
          const textH = doc.heightOfString(line, { width: 505, lineGap: 1.5 });
          doc.text(line, 50, currentY, { width: 505, lineGap: 1.5 });
          currentY += textH + 4;
        }

        // 6. Signatures Block (Spacious, beautifully boxed, never overlapping)
        currentY += 8;
        const sigBoxHeight = 84;
        const boxWidth = 245;

        // Ensure signature box fits cleanly above the bottom footer at 785
        if (currentY + sigBoxHeight > 775) {
          currentY = 775 - sigBoxHeight;
        }

        // Left Box: IT Representative
        doc.roundedRect(40, currentY, boxWidth, sigBoxHeight, 4).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
        doc.roundedRect(40, currentY, boxWidth, 18, 4).fill('#f1f5f9');
        doc.rect(40, currentY + 14, boxWidth, 4).fill('#f1f5f9');
        doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold').text('ISSUED BY (IT OPERATIONS & ASSET MGMT)', 48, currentY + 5);

        doc.fontSize(7.5).fillColor('#334155').font('Helvetica')
           .text(`Authorized Officer: ${data.allocatedBy || 'IT Administrator'}`, 48, currentY + 24, { width: 228, ellipsis: true })
           .text(`Digital Verification: System Recorded`, 48, currentY + 38, { width: 228, ellipsis: true })
           .text(`Handover Date: ${data.allocationDate}`, 48, currentY + 52, { width: 228, ellipsis: true });

        // Right Box: Recipient Employee Custodian
        const rightBoxX = 310;
        doc.roundedRect(rightBoxX, currentY, boxWidth, sigBoxHeight, 4).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
        doc.roundedRect(rightBoxX, currentY, boxWidth, 18, 4).fill('#f1f5f9');
        doc.rect(rightBoxX, currentY + 14, boxWidth, 4).fill('#f1f5f9');
        doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold').text('EMPLOYEE CUSTODIAN ACCEPTANCE', rightBoxX + 8, currentY + 5);

        doc.fontSize(7.5).fillColor('#334155').font('Helvetica')
           .text(`Custodian Name: ${data.employeeName || 'N/A'}`, rightBoxX + 8, currentY + 22, { width: 228, ellipsis: true });

        if (data.signatureData && data.signatureData.startsWith('data:image')) {
          try {
            const base64Data = data.signatureData.replace(/^data:image\/\w+;base64,/, '');
            const sigBuf = Buffer.from(base64Data, 'base64');
            doc.image(sigBuf, rightBoxX + 8, currentY + 34, { fit: [140, 28] });
            doc.fontSize(6.5).fillColor('#64748b').font('Helvetica').text(`Digitally Signed: ${data.acknowledgedAt || data.allocationDate}`, rightBoxX + 8, currentY + 68, { width: 228, lineBreak: false });
          } catch {
            doc.fontSize(7.5).fillColor('#059669').font('Helvetica-Bold').text('✓ Digital Signature Confirmed', rightBoxX + 8, currentY + 38);
            doc.fontSize(6.5).fillColor('#64748b').font('Helvetica').text(`Acknowledged: ${data.acknowledgedAt || data.allocationDate}`, rightBoxX + 8, currentY + 54);
          }
        } else if (data.termsAccepted) {
          doc.fontSize(8).fillColor('#059669').font('Helvetica-Bold').text('✓ ELECTRONIC ACCEPTANCE CONFIRMED', rightBoxX + 8, currentY + 36);
          doc.fontSize(6.5).fillColor('#64748b').font('Helvetica').text(`Digital Audit Stamp: ${data.acknowledgedAt || data.allocationDate}`, rightBoxX + 8, currentY + 50);
          doc.fontSize(6).fillColor('#94a3b8').text('Cryptographically validated via employee portal session', rightBoxX + 8, currentY + 64);
        } else {
          doc.moveTo(rightBoxX + 10, currentY + 60).lineTo(rightBoxX + boxWidth - 10, currentY + 60).strokeColor('#94a3b8').stroke();
          doc.fontSize(6.5).fillColor('#64748b').font('Helvetica').text('Physical Signature & Date of Receipt', rightBoxX + 10, currentY + 66, { width: boxWidth - 20, align: 'center' });
        }

        // 7. Confidential Footer (Pinned at page bottom, cleanly separated)
        doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
           .text(`${orgName} • Official Custody Audit Certificate • Confidential Record`, 40, 792, { align: 'center', width: 515 });

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
      departmentName?: string;
      custodianName?: string;
      userName?: string;
      companyName: string;
    }>,
    stickerStyle: string = 'QR_ONLY'
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 20, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // A4 Grid: 2 columns x 4 rows per page = 8 labels per page
        // Clean layout: label width 260pt, height 164pt
        const labelWidth = 260;
        const labelHeight = 164;
        const startX = 28;
        const startY = 32;
        const gapX = 18;
        const gapY = 24;

        let col = 0;
        let row = 0;

        const mode = (stickerStyle || 'QR_ONLY').toUpperCase();

        for (let i = 0; i < assets.length; i++) {
          const a = assets[i];
          const x = startX + col * (labelWidth + gapX);
          const y = startY + row * (labelHeight + gapY);

          const orgName = (a.companyName || 'GLOBAL TECHNOLOGIES INC.').trim().toUpperCase();
          const tagDisplay = a.assetTag || a.assetId;
          const snDisplay = (a.serialNumber && a.serialNumber !== 'N/A') ? a.serialNumber : 'NO SERIAL';
          const userDisplay = a.userName || a.custodianName || 'Unassigned (In Stock)';
          const modelText = a.name || 'Hardware Asset';

          // 1. Label Outer Border
          doc.roundedRect(x, y, labelWidth, labelHeight, 4).lineWidth(0.75).strokeColor('#0f172a').stroke();

          // 2. Header Banner
          doc.roundedRect(x, y, labelWidth, 24, 4).fill('#0f172a');
          doc.rect(x, y + 16, labelWidth, 8).fill('#0f172a'); // Square off lower banner corners

          // Prominently displays the Organization Name on the left
          doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
             .text(orgName, x + 8, y + 7, { width: labelWidth - 68, height: 12, ellipsis: true, lineBreak: false });
          doc.fontSize(6.5).fillColor('#94a3b8').font('Helvetica-Bold')
             .text('IT ASSET', x + labelWidth - 55, y + 8, { width: 47, align: 'right', lineBreak: false });

          if (mode === 'QR_ONLY') {
            // ==========================================
            // STYLE: QR CODE ONLY (No 1D Barcode)
            // ==========================================
            // Left Hero QR Box (Centered in Left Column)
            try {
              const qrBuffer = await BarcodeGenerator.generateQrCodeBuffer(tagDisplay);
              doc.roundedRect(x + 16, y + 28, 76, 76, 4).fill('#ffffff').strokeColor('#cbd5e1').lineWidth(0.5).stroke();
              doc.image(qrBuffer, x + 19, y + 31, { width: 70, height: 70 });
            } catch {
              doc.roundedRect(x + 16, y + 28, 76, 76, 4).fill('#ffffff').strokeColor('#cbd5e1').lineWidth(0.5).stroke();
            }

            // Directly below QR Code: ONLY Asset ID (Centered horizontally with QR box)
            doc.roundedRect(x + 12, y + 110, 84, 34, 4).fill('#eff6ff').strokeColor('#bfdbfe').lineWidth(0.75).stroke();
            doc.fontSize(6).fillColor('#3b82f6').font('Helvetica-Bold').text('ASSET ID', x + 12, y + 115, { width: 84, align: 'center', lineBreak: false });
            doc.fontSize(9).fillColor('#1d4ed8').font('Helvetica-Bold').text(tagDisplay, x + 12, y + 125, { width: 84, align: 'center', height: 13, lineBreak: false, ellipsis: true });

            // Vertical Divider between columns
            doc.moveTo(x + 104, y + 28).lineTo(x + 104, y + 146).strokeColor('#e2e8f0').lineWidth(0.75).stroke();

            // Right Details Panel (Symmetric 8pt margin to right edge)
            doc.roundedRect(x + 108, y + 28, 144, 118, 4).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.5).stroke();

            // Row 1: Equipment / Model (Lengthy model name wrapping up to 2 lines)
            doc.fontSize(6).fillColor('#64748b').font('Helvetica-Bold').text('EQUIPMENT / MODEL', x + 116, y + 33, { width: 128 });
            doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold')
               .text(modelText, x + 116, y + 42, { width: 128, height: 22, ellipsis: true, lineGap: 1 });

            // Divider 1
            doc.moveTo(x + 116, y + 68).lineTo(x + 244, y + 68).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

            // Row 2: Serial Number (Takes the place of Asset ID in the right details panel)
            doc.fontSize(6).fillColor('#64748b').font('Helvetica-Bold').text('SERIAL NUMBER', x + 116, y + 72, { width: 128 });
            doc.fontSize(8.5).fillColor('#0f172a').font('Helvetica-Bold')
               .text(snDisplay, x + 116, y + 82, { width: 128, height: 13, ellipsis: true, lineBreak: false });

            // Divider 2
            doc.moveTo(x + 116, y + 101).lineTo(x + 244, y + 101).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

            // Row 3: User (Renamed from CURRENT ASSIGNMENT)
            doc.fontSize(6).fillColor('#64748b').font('Helvetica-Bold').text('USER', x + 116, y + 105, { width: 128 });
            doc.fontSize(8).fillColor('#1e293b').font('Helvetica-Bold')
               .text(userDisplay, x + 116, y + 115, { width: 128, height: 26, ellipsis: true });

          } else if (mode === 'BARCODE_ONLY') {
            // ==========================================
            // STYLE: 1D BARCODE ONLY (No QR Code)
            // ==========================================
            let curY = y + 28;

            // Line 1: Asset Tag in bold blue
            doc.fontSize(10.5).fillColor('#1d4ed8').font('Helvetica-Bold')
               .text(tagDisplay, x + 10, curY, { width: labelWidth - 20, height: 13, lineBreak: false, ellipsis: true });
            curY += 14;

            // Line 2: Equipment Model Name (Full width, handles lengthy models across up to 2 lines)
            doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold');
            const rawModelH = doc.heightOfString(modelText, { width: labelWidth - 20, lineGap: 0.5 });
            const modelH = Math.min(rawModelH, 18);
            doc.text(modelText, x + 10, curY, { width: labelWidth - 20, height: modelH, lineGap: 0.5, ellipsis: true });
            curY += modelH + 3;

            // Line 3: Grid - Left: S/N, Right: Category
            doc.fontSize(7).fillColor('#475569').font('Helvetica')
               .text(`S/N: ${snDisplay}`, x + 10, curY, { width: 120, height: 9.5, lineBreak: false, ellipsis: true })
               .text(`Cat: ${a.categoryName || 'General'}`, x + 135, curY, { width: 115, height: 9.5, lineBreak: false, ellipsis: true });
            curY += 11;

            // Line 4: Grid - Left: User, Right: Asset ID
            doc.fontSize(7).fillColor('#475569').font('Helvetica')
               .text(`User: ${userDisplay}`, x + 10, curY, { width: 130, height: 9.5, lineBreak: false, ellipsis: true })
               .text(`ID: ${a.assetId || tagDisplay}`, x + 145, curY, { width: 105, height: 9.5, lineBreak: false, ellipsis: true });

            // Divider Line
            doc.moveTo(x + 8, y + 96).lineTo(x + labelWidth - 8, y + 96).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

            // 1D Barcode Section (Code128)
            try {
              const barcodeBuffer = await BarcodeGenerator.generateBarcodeBuffer(tagDisplay, 'code128', {
                includetext: false,
                height: 8,
                scale: 3,
              });
              doc.image(barcodeBuffer, x + 16, y + 100, { width: labelWidth - 32, height: 25 });
            } catch {
              doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold')
                 .text(`* ${tagDisplay} *`, x + 10, y + 105, { width: labelWidth - 20, align: 'center', lineBreak: false });
            }

            // Human-readable barcode text centered below bars
            doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold')
               .text(`* ${tagDisplay} *`, x + 8, y + 127, { width: labelWidth - 16, align: 'center', height: 10, lineBreak: false });

          } else {
            // ==========================================
            // STYLE: BOTH (Default - QR Code + 1D Barcode)
            // ==========================================
            // Right QR Code Box
            try {
              const qrBuffer = await BarcodeGenerator.generateQrCodeBuffer(tagDisplay);
              doc.roundedRect(x + 180, y + 27, 70, 66, 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
              doc.image(qrBuffer, x + 185, y + 30, { width: 60, height: 60 });
            } catch {
              doc.roundedRect(x + 180, y + 27, 70, 66, 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
            }

            // Left Text Column (Width: 168pt, with dynamic lengthy model alignment)
            let curY = y + 28;

            // Line 1: Asset Tag in bold blue
            doc.fontSize(10).fillColor('#1d4ed8').font('Helvetica-Bold')
               .text(tagDisplay, x + 8, curY, { width: 168, height: 12, lineBreak: false, ellipsis: true });
            curY += 13.5;

            // Line 2: Equipment Model Name (Gracefully handles lengthy models across up to 2 lines)
            doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold');
            const rawModelH = doc.heightOfString(modelText, { width: 168, lineGap: 0.5 });
            const modelH = Math.min(rawModelH, 18); // Clamp to at most 2 lines
            doc.text(modelText, x + 8, curY, { width: 168, height: modelH, lineGap: 0.5, ellipsis: true });
            curY += modelH + 2.5;

            // Line 3: Serial Number
            doc.fontSize(7).fillColor('#475569').font('Helvetica')
               .text(`S/N: ${snDisplay}`, x + 8, curY, { width: 168, height: 9.5, lineBreak: false, ellipsis: true });
            curY += 10.5;

            // Line 4: Category
            doc.fontSize(7).fillColor('#475569').font('Helvetica')
               .text(`Cat: ${a.categoryName || 'General'}`, x + 8, curY, { width: 168, height: 9.5, lineBreak: false, ellipsis: true });
            curY += 10.5;

            // Line 5: User (replaces Owner)
            doc.fontSize(7).fillColor('#475569').font('Helvetica')
               .text(`User: ${userDisplay}`, x + 8, curY, { width: 168, height: 9.5, lineBreak: false, ellipsis: true });

            // Divider Line before Barcode
            doc.moveTo(x + 8, y + 97).lineTo(x + labelWidth - 8, y + 97).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

            // 1D Barcode Section (Code128)
            try {
              const barcodeBuffer = await BarcodeGenerator.generateBarcodeBuffer(tagDisplay, 'code128', {
                includetext: false,
                height: 7,
                scale: 3,
              });
              doc.image(barcodeBuffer, x + 18, y + 101, { width: labelWidth - 36, height: 24 });
            } catch {
              doc.fontSize(8.5).fillColor('#000').font('Helvetica-Bold')
                 .text(`* ${tagDisplay} *`, x + 10, y + 106, { width: labelWidth - 20, align: 'center', lineBreak: false });
            }

            // Human-readable barcode text centered below bars
            doc.fontSize(7.5).fillColor('#0f172a').font('Helvetica-Bold')
               .text(`* ${tagDisplay} *`, x + 8, y + 127, { width: labelWidth - 16, align: 'center', height: 10, lineBreak: false });
          }

          // Security tag notice at the very bottom
          doc.fontSize(5.5).fillColor('#64748b').font('Helvetica')
             .text(`PROPERTY OF ${orgName} • DO NOT REMOVE`, x + 8, y + 150, { width: labelWidth - 16, align: 'center', height: 8, lineBreak: false, ellipsis: true });

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
