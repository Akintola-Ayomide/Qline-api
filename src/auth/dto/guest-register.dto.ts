import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for the `POST /auth/guest` endpoint.
 *
 * Contains the fields required to establish a guest session.
 */
export class GuestRegisterDto {
    /** The guest user's display name. */
    @IsString()
    name: string;

    /** Optional phone number for receiving SMS queue notifications. */
    @IsString()
    @IsOptional()
    phone?: string;
}
