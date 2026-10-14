/**
 * ITAM Disaster Recovery Command-Line Interface (CLI)
 * Version 3.0 Custom Edition
 * 
 * Usage:
 *   npx tsx src/disasterRecovery/cli.ts backup
 *   npx tsx src/disasterRecovery/cli.ts restore <path-to-archive.itam-backup>
 *   npx tsx src/disasterRecovery/cli.ts list
 *   npx tsx src/disasterRecovery/cli.ts test-cloud
 */
import fs from 'fs';
import path from 'path';
import { DisasterRecoveryService } from './disasterRecoveryService.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('🛡️ IT Asset Management — Disaster Recovery CLI (v3.0.0)');
  console.log('========================================================\n');

  try {
    switch (command) {
      case 'backup': {
        console.log('📦 Generating complete disaster recovery snapshot...');
        const result = await DisasterRecoveryService.createBackup({ id: 'CLI_ADMIN', email: 'cli@itam.local' });
        console.log(`\n✅ Snapshot generated successfully:`);
        console.log(`- File: ${result.filename}`);
        console.log(`- Path: ${result.filePath}`);
        console.log(`- Size: ${(result.manifest.fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- SHA-256 Checksum: ${result.manifest.checksumSha256}`);
        console.log(`- Total Records: ${Object.values(result.manifest.recordCounts).reduce((a, b) => a + b, 0)}`);
        break;
      }

      case 'restore': {
        const targetPath = args[1];
        if (!targetPath) {
          console.error('❌ Error: Please specify the backup archive path to restore.');
          console.error('Usage: npx tsx src/disasterRecovery/cli.ts restore <path-to-archive>');
          process.exit(1);
        }

        const resolvedPath = path.resolve(process.cwd(), targetPath);
        if (!fs.existsSync(resolvedPath)) {
          console.error(`❌ Error: Backup file not found: ${resolvedPath}`);
          process.exit(1);
        }

        console.log(`🔄 Reading snapshot archive from: ${resolvedPath}...`);
        const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
        const restoreResult = await DisasterRecoveryService.restoreBackup(fileContent);

        console.log(`\n🎉 System restoration completed!`);
        console.log(`- Snapshot ID: ${restoreResult.backupId}`);
        console.log(`- Timestamp: ${restoreResult.timestamp}`);
        console.log(`- Total Entities Restored: ${restoreResult.totalRecords}`);
        for (const [entity, count] of Object.entries(restoreResult.recordsRestored)) {
          console.log(`  * ${entity}: ${count}`);
        }
        break;
      }

      case 'list': {
        const history = await DisasterRecoveryService.getHistory();
        console.log(`📋 Found ${history.length} snapshot archives in vault:\n`);
        history.forEach((h, idx) => {
          console.log(`[${idx + 1}] ${h.filename}`);
          console.log(`    Date: ${h.timestamp} | Size: ${h.formattedSize} | Checksum: ${h.checksumSha256.substring(0, 16)}...`);
        });
        break;
      }

      case 'test-cloud': {
        const config = await DisasterRecoveryService.getConfig();
        console.log(`🌐 Testing connection for active provider: ${config.provider}...`);
        const result = await DisasterRecoveryService.testConnection(config);
        if (result.success) {
          console.log(`✅ Success: ${result.message} (Latency: ${result.latencyMs} ms)`);
        } else {
          console.error(`❌ Connection failed: ${result.message}`);
        }
        break;
      }

      case 'help':
      default: {
        console.log('Available Commands:');
        console.log('  backup               Create a full database, attachments & customization snapshot');
        console.log('  restore <file>       Restore complete system state from .itam-backup file');
        console.log('  list                 List all available snapshot archives and integrity hashes');
        console.log('  test-cloud           Test connectivity to configured cloud storage / NAS target');
        break;
      }
    }
  } catch (err: any) {
    console.error('\n❌ Operation failed:', err.message || err);
    process.exit(1);
  }
}

main();
