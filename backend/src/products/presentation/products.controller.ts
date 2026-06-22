import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { ProductsService } from '../application/services/products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../../types/express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import sharp from 'sharp';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
} from './dto/products.dto';

@ApiTags('Products')
@Controller('api/v1')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({
    name: 'category_id',
    required: false,
    type: String,
    description: 'Filter by category UUID',
  })
  @ApiQuery({
    name: 'include_modifiers',
    required: false,
    type: String,
    description: 'Include modifier groups (true/false)',
  })
  @ApiResponse({ status: 200, description: 'Products retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProducts(
    @Query('category_id') categoryId?: string,
    @Query('include_modifiers') includeModifiers?: string,
  ) {
    const products = await this.productsService.findAll(
      categoryId,
      includeModifiers === 'true',
    );
    return { success: true, data: products };
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCategories() {
    const categories = await this.productsService.getCategories();
    return { success: true, data: categories };
  }

  private sanitizeImageUrl(imageUrl: string | undefined): string | undefined {
    if (!imageUrl) return undefined;
    // SECURITY: Only allow relative paths under /uploads/ or HTTPS URLs from approved CDNs
    const isRelativeUpload =
      /^\/uploads\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg|gif|svg)$/.test(imageUrl);
    const isApprovedCdn =
      /^https:\/\/(cdn\.|img\.|static\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(\/.*)?$/.test(
        imageUrl,
      );
    if (isRelativeUpload || isApprovedCdn) {
      return imageUrl;
    }
    // SECURITY: Reject any path traversal attempts or invalid URLs
    if (
      imageUrl.includes('..') ||
      imageUrl.includes('://') ||
      (imageUrl.startsWith('/') && !imageUrl.startsWith('/uploads/'))
    ) {
      return undefined;
    }
    return imageUrl;
  }

  private async processImageUpload(
    file: Express.Multer.File | undefined,
  ): Promise<string | undefined> {
    if (!file) return undefined;
    const uploadDir =
      process.env.STORAGE_PATH ||
      join(__dirname, '..', '..', '..', '..', 'frontend', 'static', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filepath = join(uploadDir, `${uuidv4()}.webp`);
    await sharp(file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);
    return `/uploads/${filepath.split('/').pop()}`;
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create new product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024,
      },
    }),
  )
  async createProduct(
    @Body() body: CreateProductDto,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const payload = {
      ...body,
      base_price: Number(body.base_price),
      image_url: await this.processImageUpload(file),
    };
    const product = await this.productsService.create(payload, req.user.id);
    return { success: true, data: product };
  }

  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024,
      },
    }),
  )
  async updateProduct(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const uploadedUrl = await this.processImageUpload(file);
    // SECURITY: Sanitize image_url to prevent path traversal and XSS
    const sanitizedImageUrl =
      uploadedUrl || this.sanitizeImageUrl(body.image_url);
    const payload: Prisma.ProductUncheckedUpdateInput = { ...body };
    if (body.base_price) payload.base_price = Number(body.base_price);
    if (sanitizedImageUrl) payload.image_url = sanitizedImageUrl;
    const product = await this.productsService.update(id, payload, req.user.id);
    return { success: true, data: product };
  }

  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async deleteProduct(@Param('id') id: string) {
    const product = await this.productsService.deleteProduct(id);
    return { success: true, data: product };
  }

  @Post('admin/products/:id/modifier-groups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create modifier group for product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  @ApiResponse({ status: 201, description: 'Modifier group created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async createModifierGroup(
    @Param('id') id: string,
    @Body() body: CreateModifierGroupDto,
  ) {
    const payload = { ...body, product_id: id };
    const group = await this.productsService.createModifierGroup(id, payload);
    return { success: true, data: group };
  }

  @Post('admin/modifier-groups/:id/options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create modifier option for group' })
  @ApiParam({ name: 'id', description: 'Modifier group UUID' })
  @ApiResponse({ status: 201, description: 'Modifier option created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async createModifierOption(
    @Param('id') id: string,
    @Body() body: CreateModifierOptionDto,
  ) {
    const payload = {
      ...body,
      group_id: id,
    } as Prisma.ProductModifierOptionUncheckedCreateInput;
    const option = await this.productsService.createModifierOption(id, payload);
    return { success: true, data: option };
  }

  @Patch('admin/modifier-groups/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update modifier group' })
  @ApiParam({ name: 'id', description: 'Modifier group UUID' })
  @ApiResponse({ status: 200, description: 'Modifier group updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Modifier group not found' })
  async updateModifierGroup(
    @Param('id') id: string,
    @Body() body: UpdateModifierGroupDto,
  ) {
    const group = await this.productsService.updateModifierGroup(id, body);
    return { success: true, data: group };
  }

  @Patch('admin/modifier-options/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update modifier option' })
  @ApiParam({ name: 'id', description: 'Modifier option UUID' })
  @ApiResponse({ status: 200, description: 'Modifier option updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Modifier option not found' })
  async updateModifierOption(
    @Param('id') id: string,
    @Body() body: UpdateModifierOptionDto,
  ) {
    const option = await this.productsService.updateModifierOption(id, body);
    return { success: true, data: option };
  }
}
