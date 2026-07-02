import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';

export class BackupManager {
  private static backupDir = path.join(process.cwd(), 'backups');
  private static logger = Logger.getInstance();

  public static backupFile(filename: string): boolean {
    try {
      const sourcePath = path.join(process.cwd(), filename);
      if (!fs.existsSync(sourcePath)) {
        return false;
      }

      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const destFilename = `${base}_${timestamp}${ext}`;
      const destPath = path.join(this.backupDir, destFilename);

      fs.copyFileSync(sourcePath, destPath);
      this.logger.system('BACKUP', `Successfully backed up ${filename} to ${destFilename}`, 'SUCCESS');
      
      this.rotateBackups(base, ext, 30);
      return true;
    } catch (error) {
      this.logger.error('BACKUP', `Failed to create backup for ${filename}`, error);
      return false;
    }
  }

  private static rotateBackups(baseName: string, extension: string, keepCount: number) {
    try {
      if (!fs.existsSync(this.backupDir)) return;
      
      const files = fs.readdirSync(this.backupDir);
      const filtered = files
        .filter(f => f.startsWith(baseName) && f.endsWith(extension))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          mtime: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => a.mtime - b.mtime); // oldest first

      if (filtered.length > keepCount) {
        const toDeleteCount = filtered.length - keepCount;
        for (let i = 0; i < toDeleteCount; i++) {
          fs.unlinkSync(filtered[i].path);
          this.logger.system('BACKUP', `Pruned old backup file: ${filtered[i].name}`);
        }
      }
    } catch (error) {
      this.logger.error('BACKUP', `Error rotating backups for ${baseName}`, error);
    }
  }
}
