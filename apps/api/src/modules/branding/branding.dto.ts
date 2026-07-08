import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BrandingDto {
  @ApiProperty({ type: String, nullable: true, description: 'URL assinada (curta) do logo, ou null' })
  logoUrl!: string | null;
}

export class SignLogoDto {
  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

export class SignUploadResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty() uploadUrl!: string;
}

export class ConfirmLogoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key!: string;
}
