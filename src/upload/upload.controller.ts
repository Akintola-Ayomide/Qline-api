import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
    constructor(private readonly storageService: StorageService) { }

    @Post('image')
    @UseInterceptors(
        FileInterceptor('image', {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
                    return callback(
                        new BadRequestException('Only JPG, JPEG, PNG, GIF, and WEBP image files are allowed!'),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    async uploadImage(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('No file uploaded or file format is invalid');
        }
        const url = await this.storageService.saveFile(file);
        return { url };
    }
}
