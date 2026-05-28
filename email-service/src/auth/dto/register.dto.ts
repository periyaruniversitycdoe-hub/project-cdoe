import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'student@periyaruniversity.ac.in' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'Rajesh Kumar',
    description: 'Full name of the applicant',
  })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required.' })
  @MinLength(2,  { message: 'Full name must be at least 2 characters.' })
  @MaxLength(120, { message: 'Full name must not exceed 120 characters.' })
  fullName: string;

  @ApiProperty({
    example: 'Str0ng@Pass!',
    description:
      'Min 8 chars, at least one uppercase, one lowercase, one digit, one special character.',
  })
  @IsString()
  @MinLength(8,   { message: 'Password must be at least 8 characters.' })
  @MaxLength(72,  { message: 'Password must not exceed 72 characters.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
  })
  password: string;
}
