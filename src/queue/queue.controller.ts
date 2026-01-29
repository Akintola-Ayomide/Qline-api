import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Req,
    Param,
    ParseIntPipe,
    Patch,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueDto, JoinQueueDto, PrioritizeUserDto } from './dto/queue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '../entities/user.entity';

@Controller('queues')
@UseGuards(JwtAuthGuard)
export class QueueController {
    constructor(private readonly queueService: QueueService) { }

    @Post()
    async createQueue(@Req() req: any, @Body() createQueueDto: CreateQueueDto) {
        return this.queueService.createQueue(req.user, createQueueDto);
    }

    @Get('my')
    async getMyQueues(@Req() req: any) {
        return this.queueService.getMyQueues(req.user);
    }

    @Get(':id')
    async getQueue(@Param('id', ParseIntPipe) id: number) {
        return this.queueService.getQueueById(id);
    }

    @Post('join')
    async joinQueue(@Req() req: any, @Body() joinQueueDto: JoinQueueDto) {
        return this.queueService.joinQueue(req.user, joinQueueDto);
    }

    @Get(':id/status')
    async getQueueStatus(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.queueService.getQueueStatus(req.user, id);
    }

    // --- Owner Management Endpoints ---

    @Post('verify-qr')
    async verifyQr(@Req() req: any, @Body('token') token: string) {
        return this.queueService.verifyQrCode(token, req.user.id);
    }

    @Patch(':id/prioritize')
    async prioritizeUser(
        @Req() req: any,
        @Param('id', ParseIntPipe) queueId: number,
        @Body() dto: PrioritizeUserDto,
    ) {
        return this.queueService.prioritizeUser(req.user.id, queueId, dto);
    }
}
