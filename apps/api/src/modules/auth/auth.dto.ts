import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Clínica Cuidar' })
  tenantName!: string;

  @ApiProperty({ example: 'dono@clinica.com' })
  email!: string;

  @ApiProperty({ example: 'Maria Dona' })
  name!: string;

  @ApiProperty({ example: 'senha-forte-aqui', minLength: 8 })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'dono@clinica.com' })
  email!: string;

  @ApiProperty({ example: 'senha-forte-aqui' })
  password!: string;

  @ApiProperty({ description: 'Tenant ativo (quando o usuário pertence a mais de um)', required: false })
  tenantId?: string;
}

export class TokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}

export class AuthMeDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ example: 'admin' })
  role!: string;
}
