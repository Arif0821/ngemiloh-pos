import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ProductsService } from '../application/services/products.service';
import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';
import { RolesGuard } from '../../auth/strategies/roles.guard';
import { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import sharp from 'sharp';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { CreateProductDto, UpdateProductDto, CreateModifierGroupDto, UpdateModifierGroupDto, CreateModifierOptionDto, UpdateModifierOptionDto } from './dto/products.dto';

@Controller('api/v1')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  @UseGuards(JwtAuthGuard)
  async getProducts(
    @Query('category_id') categoryId?: string,
    @Query('include_modifiers') includeModifiers?: string
  ) {
    const products = await this.productsService.findAll(categoryId, includeModifiers === 'true');
    return { success: true, data: products };
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async getCategories() {
    const categories = await this.productsService.getCategories();
    return { success: true, data: categories };
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 } }))
  async createProduct(@Body() body: CreateProductDto, @Req() req: Request & { user: any }, @UploadedFile() file: Express.Multer.File) {
    
    let imageUrl = body.image_url;
    
    if (file) {
      const uploadDir = process.env.STORAGE_PATH || join(__dirname, '..', '..', '..', '..', 'frontend', 'static', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const filename = `${uuidv4()}.webp`;
      const filepath = join(uploadDir, filename);
      
      await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);
        
      imageUrl = `/uploads/${filename}`;
    }

    const payload = { ...body, base_price: Number(body.base_price), image_url: imageUrl };
    const product = await this.productsService.create(payload, req.user.id);
    return { success: true, data: product };
  }

  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 } }))
  async updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto, @Req() req: Request & { user: any }, @UploadedFile() file: Express.Multer.File) {
    
    let imageUrl = body.image_url;
    
    if (file) {
      const uploadDir = process.env.STORAGE_PATH || join(__dirname, '..', '..', '..', '..', 'frontend', 'static', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const filename = `${uuidv4()}.webp`;
      const filepath = join(uploadDir, filename);
      
      await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);
        
      imageUrl = `/uploads/${filename}`;
    }

    const payload = { ...body };
    if (body.base_price) payload.base_price = Number(body.base_price);
    if (imageUrl) payload.image_url = imageUrl;
    
    const product = await this.productsService.update(id, payload, req.user.id);
    return { success: true, data: product };
  }

  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async deleteProduct(@Param('id') id: string) {
    const product = await this.productsService.deleteProduct(id);
    return { success: true, data: product };
  }

  @Post('admin/products/:id/modifier-groups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async createModifierGroup(@Param('id') id: string, @Body() body: CreateModifierGroupDto) {
    const group = await this.productsService.createModifierGroup(id, body);
    return { success: true, data: group };
  }

  @Post('admin/modifier-groups/:id/options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async createModifierOption(@Param('id') id: string, @Body() body: CreateModifierOptionDto) {
    const option = await this.productsService.createModifierOption(id, body);
    return { success: true, data: option };
  }

  @Patch('admin/modifier-groups/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async updateModifierGroup(@Param('id') id: string, @Body() body: UpdateModifierGroupDto) {
    const group = await this.productsService.updateModifierGroup(id, body);
    return { success: true, data: group };
  }

  @Patch('admin/modifier-options/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async updateModifierOption(@Param('id') id: string, @Body() body: UpdateModifierOptionDto) {
    const option = await this.productsService.updateModifierOption(id, body);
    return { success: true, data: option };
  }
}
