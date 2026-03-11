import { PrismaClient, UserRole, ProductUnit } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Limpiar datos existentes
  await prisma.stockMovement.deleteMany()
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.productPresentation.deleteMany()
  await prisma.product.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Base de datos limpia')

  // Crear usuarios
  // ⚠️  No usar contraseñas hardcodeadas. En desarrollo se usa un valor por defecto SOLO para seed local.
  // En producción: pasar SEED_ADMIN_PASS y SEED_CAJERO_PASS como variables de entorno.
  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASS ?? 'admin_dev_local', 12)
  const cajeroPassword = await bcrypt.hash(process.env.SEED_CAJERO_PASS ?? 'cajero_dev_local', 12)

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      fullName: 'Administrador Principal',
      isActive: true,
    },
  })

  const cajero = await prisma.user.create({
    data: {
      username: 'cajero1',
      passwordHash: cajeroPassword,
      role: UserRole.CAJERO,
      fullName: 'Juan Pérez',
      isActive: true,
    },
  })

  console.log('✅ Usuarios creados:', { admin: admin.username, cajero: cajero.username })

  // Crear productos con presentaciones
  const productos = [
    {
      sku: 'CEM-001',
      name: 'Cemento Portland 50kg',
      unit: ProductUnit.KILO,
      price: 8.5,
      stock: 100,
      minStock: 20,
      presentations: [
        { name: 'KILO', unit: ProductUnit.KILO, factorToBase: 1, isDefault: true },
        { name: 'BOLSA 50kg', unit: ProductUnit.KILO, factorToBase: 50, isDefault: false },
      ],
    },
    {
      sku: 'CAL-001',
      name: 'Cal Hidratada 25kg',
      unit: ProductUnit.KILO,
      price: 4.2,
      stock: 80,
      minStock: 15,
      presentations: [
        { name: 'KILO', unit: ProductUnit.KILO, factorToBase: 1, isDefault: true },
        { name: 'BOLSA 25kg', unit: ProductUnit.KILO, factorToBase: 25, isDefault: false },
      ],
    },
    {
      sku: 'MAR-001',
      name: 'Martillo de Garra 16oz',
      unit: ProductUnit.UNIDAD,
      price: 12.99,
      stock: 45,
      minStock: 10,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'DES-001',
      name: 'Destornillador Phillips #2',
      unit: ProductUnit.UNIDAD,
      price: 5.5,
      stock: 60,
      minStock: 15,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'TAL-001',
      name: 'Taladro Eléctrico 600W',
      unit: ProductUnit.UNIDAD,
      price: 89.99,
      stock: 12,
      minStock: 5,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'PIN-001',
      name: 'Pintura Latex Interior Blanco 1gl',
      unit: ProductUnit.LITRO,
      price: 28.5,
      stock: 35,
      minStock: 8,
      presentations: [
        { name: 'LITRO', unit: ProductUnit.LITRO, factorToBase: 1, isDefault: true },
        { name: 'GALON (3.785L)', unit: ProductUnit.LITRO, factorToBase: 3.785, isDefault: false },
      ],
    },
    {
      sku: 'BRO-001',
      name: 'Brocha 3 pulgadas',
      unit: ProductUnit.UNIDAD,
      price: 3.75,
      stock: 50,
      minStock: 20,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'TUB-001',
      name: 'Tubo PVC 1/2" x 3m',
      unit: ProductUnit.METRO,
      price: 6.8,
      stock: 90,
      minStock: 25,
      presentations: [
        { name: 'METRO', unit: ProductUnit.METRO, factorToBase: 1, isDefault: true },
        { name: 'ROLLO 100m', unit: ProductUnit.METRO, factorToBase: 100, isDefault: false },
      ],
    },
    {
      sku: 'COD-001',
      name: 'Codo PVC 1/2" 90°',
      unit: ProductUnit.UNIDAD,
      price: 0.85,
      stock: 200,
      minStock: 50,
      presentations: [
        { name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true },
        { name: 'CAJA (10u)', unit: ProductUnit.UNIDAD, factorToBase: 10, isDefault: false },
      ],
    },
    {
      sku: 'LLA-001',
      name: 'Llave Stillson 14"',
      unit: ProductUnit.UNIDAD,
      price: 15.6,
      stock: 22,
      minStock: 8,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'CLA-001',
      name: 'Clavos 2.5"',
      unit: ProductUnit.KILO,
      price: 2.3,
      stock: 150,
      minStock: 40,
      presentations: [
        { name: 'KILO', unit: ProductUnit.KILO, factorToBase: 1, isDefault: true },
        { name: 'CAJA 5kg', unit: ProductUnit.KILO, factorToBase: 5, isDefault: false },
        { name: 'CAJA 25kg', unit: ProductUnit.KILO, factorToBase: 25, isDefault: false },
      ],
    },
    {
      sku: 'TOR-001',
      name: 'Tornillos Galvanizados 1"',
      unit: ProductUnit.CAJA,
      price: 4.9,
      stock: 75,
      minStock: 20,
      presentations: [{ name: 'CAJA', unit: ProductUnit.CAJA, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'CAB-001',
      name: 'Cable Eléctrico #12 AWG',
      unit: ProductUnit.METRO,
      price: 1.25,
      stock: 500,
      minStock: 100,
      presentations: [
        { name: 'METRO', unit: ProductUnit.METRO, factorToBase: 1, isDefault: true },
        { name: 'ROLLO 100m', unit: ProductUnit.METRO, factorToBase: 100, isDefault: false },
      ],
    },
    {
      sku: 'INT-001',
      name: 'Interruptor Simple',
      unit: ProductUnit.UNIDAD,
      price: 2.4,
      stock: 85,
      minStock: 25,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'FOC-001',
      name: 'Foco LED 9W',
      unit: ProductUnit.UNIDAD,
      price: 3.99,
      stock: 120,
      minStock: 30,
      presentations: [
        { name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true },
        { name: 'PAQUETE (10u)', unit: ProductUnit.UNIDAD, factorToBase: 10, isDefault: false },
      ],
    },
    {
      sku: 'SIL-001',
      name: 'Silicón Transparente',
      unit: ProductUnit.UNIDAD,
      price: 5.2,
      stock: 55,
      minStock: 15,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'LIJ-001',
      name: 'Lija para Madera Grano 100',
      unit: ProductUnit.UNIDAD,
      price: 0.75,
      stock: 180,
      minStock: 50,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'CER-001',
      name: 'Cerradura de Embutir',
      unit: ProductUnit.UNIDAD,
      price: 18.5,
      stock: 28,
      minStock: 10,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'BIS-001',
      name: 'Bisagra 3" Cromada',
      unit: ProductUnit.UNIDAD,
      price: 2.8,
      stock: 95,
      minStock: 25,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'CAN-001',
      name: 'Candado de Alta Seguridad 50mm',
      unit: ProductUnit.UNIDAD,
      price: 14.75,
      stock: 40,
      minStock: 12,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'CIN-001',
      name: 'Cinta Métrica 5m',
      unit: ProductUnit.UNIDAD,
      price: 7.99,
      stock: 65,
      minStock: 18,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'NIV-001',
      name: 'Nivel de Burbuja 24"',
      unit: ProductUnit.UNIDAD,
      price: 11.2,
      stock: 30,
      minStock: 10,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'SER-001',
      name: 'Serrucho 22"',
      unit: ProductUnit.UNIDAD,
      price: 13.5,
      stock: 38,
      minStock: 12,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'ALI-001',
      name: 'Alicate Universal 8"',
      unit: ProductUnit.UNIDAD,
      price: 9.8,
      stock: 52,
      minStock: 15,
      presentations: [{ name: 'UNIDAD', unit: ProductUnit.UNIDAD, factorToBase: 1, isDefault: true }],
    },
    {
      sku: 'ARE-001',
      name: 'Arena Fina',
      unit: ProductUnit.METRO,
      price: 25.0,
      stock: 15,
      minStock: 5,
      presentations: [{ name: 'METRO (m³)', unit: ProductUnit.METRO, factorToBase: 1, isDefault: true }],
    },
  ]

  for (const prod of productos) {
    const { presentations, ...productData } = prod
    const product = await prisma.product.create({
      data: productData,
    })

    // Crear presentaciones
    for (const pres of presentations) {
      await prisma.productPresentation.create({
        data: {
          productId: product.id,
          ...pres,
        },
      })
    }
  }

  console.log(`✅ ${productos.length} productos con presentaciones creados`)

  // Crear movimientos de stock iniciales (ENTRADA)
  const allProducts = await prisma.product.findMany()
  for (const product of allProducts) {
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'ENTRADA',
        quantity: product.stock,
        reference: 'SEED_INICIAL',
        notes: 'Stock inicial de seed',
        previousStock: 0,
        newStock: product.stock,
      },
    })
  }

  console.log('✅ Movimientos de stock iniciales creados')
  console.log('🎉 Seed completado exitosamente!')
  console.log('\n📌 Credenciales de prueba:')
  console.log('   Admin: admin / admin123')
  console.log('   Cajero: cajero1 / cajero123')
  console.log('\n🛒 Ejemplos de presentaciones múltiples:')
  console.log('   • Tubo PVC (METRO / ROLLO 100m)')
  console.log('   • Cable (METRO / ROLLO 100m)')
  console.log('   • Clavos (KILO / CAJA 5kg / CAJA 25kg)')
  console.log('   • Pintura (LITRO / GALON 3.785L)')
  console.log('   • Foco LED (UNIDAD / PAQUETE 10u)')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
