import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@universidad.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin12345' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
