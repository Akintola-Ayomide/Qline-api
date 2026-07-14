/**
 * @file queue.controller.ts
 * @description Controller handling all queue-related HTTP endpoints.
 * All routes require JWT authentication.
 */

import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    UseGuards,
    Req,
    Param,
    ParseIntPipe,
    Patch,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueDto, JoinQueueDto, PrioritizeUserDto, UpdateQueueDto, UpdateQueueStatusDto, VerifyQrDto } from './dto/queue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Queue controller.
 *
 * All endpoints require a valid JWT token (via {@link JwtAuthGuard}).
 *
 * Exposes the following endpoints under the `/queues` prefix:
 *
 * | Method | Route                    | Description                          |
 * |--------|--------------------------|--------------------------------------|
 * | POST   | `/queues`                | Create a new queue                   |
 * | GET    | `/queues/my`             | Get all queues owned by the user     |
 * | GET    | `/queues/:id`            | Get a specific queue by ID           |
 * | POST   | `/queues/join`           | Join a queue                         |
 * | GET    | `/queues/:id/status`     | Get user's status in a queue         |
 * | POST   | `/queues/verify-qr`      | Verify a QR code token (owner only)  |
 * | PATCH  | `/queues/:id/prioritize` | Move a user to a new position (owner)|
 */
@Controller('queues')
export class QueueController {
    constructor(private readonly queueService: QueueService) { }

    /**
     * Creates a new queue owned by the authenticated user.
     *
     * @param req            - The Express request (contains `req.user` from JWT).
     * @param createQueueDto - The validated queue details from the request body.
     * @returns The newly created queue entity.
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    async createQueue(@Req() req, @Body() createQueueDto: CreateQueueDto) {
        return this.queueService.createQueue(req.user, createQueueDto);
    }

    /**
     * Retrieves all active queues in the system (public browse).
     */
    @Get('active')
    async getAllActiveQueues() {
        return this.queueService.getAllActiveQueues();
    }

    @Get('my')
    @UseGuards(JwtAuthGuard)
    async getMyQueues(@Req() req) {
        return this.queueService.getMyQueues(req.user);
    }

    @Get('joined')
    @UseGuards(JwtAuthGuard)
    async getJoinedQueues(@Req() req) {
        return this.queueService.getJoinedQueues(req.user);
    }

    /**
     * Retrieves a single queue by its ID.
     *
     * @param id - The queue ID parsed from the URL parameter.
     * @returns The queue entity with the owner relation loaded.
     */
    @Get(':id')
    async getQueue(@Param('id', ParseIntPipe) id: number) {
        return this.queueService.getQueueById(id);
    }

    /**
     * Allows the authenticated user to join a queue.
     *
     * @param req          - The Express request (contains `req.user` from JWT).
     * @param joinQueueDto - Contains the queue ID and optional custom data.
     * @returns The created entry, QR code token, and estimated wait time.
     */
    @Post('join')
    @UseGuards(JwtAuthGuard)
    async joinQueue(@Req() req, @Body() joinQueueDto: JoinQueueDto) {
        return this.queueService.joinQueue(req.user, joinQueueDto);
    }

    /**
     * Retrieves the authenticated user's status within a specific queue.
     *
     * @param req - The Express request (contains `req.user` from JWT).
     * @param id  - The queue ID parsed from the URL parameter.
     * @returns Position, people ahead, estimated wait time, or "not_joined".
     */
    @Get(':id/status')
    @UseGuards(JwtAuthGuard)
    async getQueueStatus(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.queueService.getQueueStatus(req.user, id);
    }

    // ──────────────────────────────────────────────
    // Owner Management Endpoints
    // ──────────────────────────────────────────────

    /**
     * Verifies a QR code token scanned by the queue owner.
     *
     * The token is validated via HMAC signature, and the caller must
     * be the owner of the queue referenced in the token.
     *
     * @param req   - The Express request (contains `req.user` from JWT).
     * @param token - The QR code token string from the request body.
     * @returns The queue entry associated with the token.
     */
    @Post('verify-qr')
    @UseGuards(JwtAuthGuard)
    async verifyQr(@Req() req, @Body() verifyQrDto: VerifyQrDto) {
        return this.queueService.verifyQrCode(verifyQrDto.token, req.user.id);
    }

    /**
     * Moves a participant to a new position in the queue (owner only).
     *
     * @param req     - The Express request (contains `req.user` from JWT).
     * @param queueId - The queue ID parsed from the URL parameter.
     * @param dto     - Contains the user ID and new position.
     * @returns The updated queue entry with the new position.
     */
    @Patch(':id/prioritize')
    @UseGuards(JwtAuthGuard)
    async prioritizeUser(
        @Req() req,
        @Param('id', ParseIntPipe) queueId: number,
        @Body() dto: PrioritizeUserDto,
    ) {
        return this.queueService.prioritizeUser(req.user.id, queueId, dto);
    }

    @Get(':id/participants')
    @UseGuards(JwtAuthGuard)
    async getQueueParticipants(
        @Req() req,
        @Param('id', ParseIntPipe) queueId: number,
    ) {
        return this.queueService.getQueueParticipants(queueId, req.user.id);
    }

    @Post(':id/serve-next')
    @UseGuards(JwtAuthGuard)
    async serveNext(
        @Req() req,
        @Param('id', ParseIntPipe) queueId: number,
    ) {
        return this.queueService.serveNextUser(queueId, req.user.id);
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard)
    async updateQueueStatus(
        @Req() req,
        @Param('id', ParseIntPipe) queueId: number,
        @Body() dto: UpdateQueueStatusDto,
    ) {
        return this.queueService.updateQueueStatus(req.user.id, queueId, dto.status);
    }

    /**
     * Updates a queue's name, description, image, or other metadata (owner only).
     *
     * @param req     - The Express request (contains `req.user` from JWT).
     * @param queueId - The queue ID parsed from the URL parameter.
     * @param dto     - The fields to update (all optional).
     * @returns The updated queue entity.
     */
    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    async updateQueue(
        @Req() req,
        @Param('id', ParseIntPipe) queueId: number,
        @Body() dto: UpdateQueueDto,
    ) {
        return this.queueService.updateQueue(req.user.id, queueId, dto);
    }

    @Post(':id/leave')
    @UseGuards(JwtAuthGuard)
    async leaveQueue(@Req() req, @Param('id', ParseIntPipe) queueId: number) {
        return this.queueService.leaveQueue(req.user, queueId);
    }

    /**
     * Deletes a queue (owner only). Removes all entries and broadcasts 'queueDeleted'.
     *
     * @param req     - The Express request (contains `req.user` from JWT).
     * @param queueId - The queue ID parsed from the URL parameter.
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteQueue(@Req() req, @Param('id', ParseIntPipe) queueId: number) {
        return this.queueService.deleteQueue(req.user.id, queueId);
    }
}
