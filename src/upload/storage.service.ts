import { Injectable, BadRequestException } from '@nestjs/common';
import { join, extname } from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

@Injectable()
export class StorageService {
    private readonly uploadDir = join(process.cwd(), 'public', 'uploads');

    async saveFile(file: any): Promise<string> {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        try {
            // Ensure the uploads folder exists
            if (!existsSync(this.uploadDir)) {
                await fs.mkdir(this.uploadDir, { recursive: true });
            }

            // Generate a unique filename to prevent collisions
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname).toLowerCase();
            const filename = `img-${uniqueSuffix}${ext}`;
            const filePath = join(this.uploadDir, filename);

            // Write the buffer to disk
            await fs.writeFile(filePath, file.buffer);

            // Return the endpoint path proxied through Next.js under /api/uploads
            return `/api/uploads/${filename}`;
        } catch (error) {
            console.error('Failed to save file locally:', error);
            throw new BadRequestException('Could not save uploaded file');
        }
    }
}
