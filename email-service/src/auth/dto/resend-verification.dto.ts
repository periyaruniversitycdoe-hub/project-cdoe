import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'student@periyaruniversity.ac.in' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @MaxLength(254)
  email: string;
}
