// backend/src/auth/auth.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @Roles(UserRole.ADMIN)
  @Get('users')
  findAllUsers() {
    return this.authService.findAllUsers();
  }

  @Roles(UserRole.ADMIN)
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.authService.updateUserRole(id, role);
  }
}
