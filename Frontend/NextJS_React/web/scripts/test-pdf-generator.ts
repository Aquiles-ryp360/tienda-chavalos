/**
 * Script de prueba para el generador de PDF de Nota de Venta
 * 
 * Uso desde la consola del navegador:
 * 1. Abre /ventas en el navegador
 * 2. Abre DevTools (F12)
 * 3. Copia y pega este código en la consola
 * 
 * O desde un componente React:
 * import { testPDFGenerator } from '@/scripts/test-pdf-generator'
 * testPDFGenerator()
 */

import { generateSalePDF } from '@/lib/pdf-generator'

/**
 * Datos de prueba completos (con todos los campos opcionales)
 */
const testSaleComplete = {
  saleNumber: 'TEST-001',
  createdAt: new Date(),
  customerName: 'Constructora Los Andes S.A.C.',
  customerDni: '87654321',
  customerRuc: '20123456789',
  customerInstitution: 'Constructora Los Andes S.A.C.',
  customerAddress: 'Av. Los Constructores 456, San Isidro, Lima',
  paymentMethod: 'Crédito 30 días',
  observations: 'Entrega programada para el lunes 20/01/2026 a las 10:00 AM. Incluye flete hasta obra.',
  subtotal: 1250.00,
  tax: 225.00,
  total: 1475.00,
  items: [
    {
      product: {
        sku: 'CEM-001',
        name: 'Cemento Sol tipo I x 42.5kg',
        unit: 'Bolsa'
      },
      soldUnit: 'Bolsa',
      soldQty: 50,
      baseQty: 50,
      unitPrice: 22.00,
      subtotal: 1100.00,
      presentation: null
    },
    {
      product: {
        sku: 'VAR-001',
        name: 'Varilla de construcción 1/2"',
        unit: 'Unidad'
      },
      soldUnit: 'Unidad',
      soldQty: 10,
      baseQty: 10,
      unitPrice: 15.00,
      subtotal: 150.00,
      presentation: null
    }
  ],
  user: {
    fullName: 'María López García'
  }
}

/**
 * Datos de prueba mínimos (sin campos opcionales)
 */
const testSaleMinimal = {
  saleNumber: 'TEST-002',
  createdAt: new Date(),
  paymentMethod: 'Efectivo',
  subtotal: 50.00,
  tax: 0,
  total: 50.00,
  items: [
    {
      product: {
        sku: 'MISC-001',
        name: 'Clavos de acero 2"',
        unit: 'kg'
      },
      soldUnit: 'kg',
      soldQty: 5,
      baseQty: 5,
      unitPrice: 10.00,
      subtotal: 50.00,
      presentation: null
    }
  ],
  user: {
    fullName: 'Carlos Ramírez'
  }
}

/**
 * Datos de prueba con presentaciones
 */
const testSaleWithPresentations = {
  saleNumber: 'TEST-003',
  createdAt: new Date(),
  customerName: 'Juan Pérez',
  customerDni: '12345678',
  paymentMethod: 'Efectivo',
  subtotal: 360.00,
  tax: 64.80,
  total: 424.80,
  items: [
    {
      product: {
        sku: 'CLAV-001',
        name: 'Clavos 2"',
        unit: 'kg'
      },
      soldUnit: 'Caja',
      soldQty: 3,
      baseQty: 30,
      unitPrice: 120.00,
      subtotal: 360.00,
      presentation: {
        name: 'Caja x 10kg',
        factorToBase: 10
      }
    }
  ],
  user: {
    fullName: 'Pedro Sánchez'
  }
}

/**
 * Prueba con múltiples items y presentaciones variadas
 */
const testSaleMixed = {
  saleNumber: 'TEST-004',
  createdAt: new Date(),
  customerName: 'Ferretería El Constructor',
  customerRuc: '20987654321',
  paymentMethod: 'Transferencia',
  observations: 'Cliente frecuente - Descuento 5% aplicado',
  subtotal: 2850.00,
  tax: 513.00,
  total: 3363.00,
  items: [
    {
      product: {
        sku: 'CEM-001',
        name: 'Cemento Sol tipo I',
        unit: 'Bolsa'
      },
      soldUnit: 'Bolsa',
      soldQty: 100,
      baseQty: 100,
      unitPrice: 22.00,
      subtotal: 2200.00,
      presentation: null
    },
    {
      product: {
        sku: 'ARE-001',
        name: 'Arena fina',
        unit: 'm3'
      },
      soldUnit: 'm3',
      soldQty: 5,
      baseQty: 5,
      unitPrice: 80.00,
      subtotal: 400.00,
      presentation: null
    },
    {
      product: {
        sku: 'CLAV-001',
        name: 'Clavos 2"',
        unit: 'kg'
      },
      soldUnit: 'Caja',
      soldQty: 2.5,
      baseQty: 25,
      unitPrice: 100.00,
      subtotal: 250.00,
      presentation: {
        name: 'Caja x 10kg',
        factorToBase: 10
      }
    }
  ],
  user: {
    fullName: 'Ana Torres Mendoza'
  }
}

/**
 * Ejecuta todas las pruebas del generador PDF
 */
export function testPDFGenerator() {
  console.group('🧪 Prueba Generador PDF - Nota de Venta')

  // Prueba 1: Venta completa en A4
  console.log('✅ Test 1: Venta completa con todos los campos (A4)')
  try {
    const pdf1 = generateSalePDF(testSaleComplete, { format: 'A4' })
    pdf1.save('Test_01_Completo_A4.pdf')
    console.log('   ✓ PDF generado: Test_01_Completo_A4.pdf')
  } catch (error) {
    console.error('   ✗ Error:', error)
  }

  // Prueba 2: Venta completa en TICKET
  console.log('✅ Test 2: Venta completa en formato TICKET (80mm)')
  try {
    const pdf2 = generateSalePDF(testSaleComplete, { format: 'TICKET' })
    pdf2.save('Test_02_Completo_Ticket.pdf')
    console.log('   ✓ PDF generado: Test_02_Completo_Ticket.pdf')
  } catch (error) {
    console.error('   ✗ Error:', error)
  }

  // Prueba 3: Venta mínima (sin datos opcionales)
  console.log('✅ Test 3: Venta mínima sin campos opcionales (A4)')
  try {
    const pdf3 = generateSalePDF(testSaleMinimal, { format: 'A4' })
    pdf3.save('Test_03_Minimo_A4.pdf')
    console.log('   ✓ PDF generado: Test_03_Minimo_A4.pdf')
  } catch (error) {
    console.error('   ✗ Error:', error)
  }

  // Prueba 4: Venta con presentaciones
  console.log('✅ Test 4: Venta con presentaciones (A4)')
  try {
    const pdf4 = generateSalePDF(testSaleWithPresentations, { format: 'A4' })
    pdf4.save('Test_04_Presentaciones_A4.pdf')
    console.log('   ✓ PDF generado: Test_04_Presentaciones_A4.pdf')
  } catch (error) {
    console.error('   ✗ Error:', error)
  }

  // Prueba 5: Venta mixta (varios items, presentaciones variadas)
  console.log('✅ Test 5: Venta mixta con múltiples items (A4)')
  try {
    const pdf5 = generateSalePDF(testSaleMixed, { format: 'A4' })
    pdf5.save('Test_05_Mixto_A4.pdf')
    console.log('   ✓ PDF generado: Test_05_Mixto_A4.pdf')
  } catch (error) {
    console.error('   ✗ Error:', error)
  }

  // Prueba 6: Venta mixta en TICKET
  console.log('✅ Test 6: Venta mixta en formato TICKET (80mm)')
  try {
    const pdf6 = generateSalePDF(testSaleMixed, { format: 'TICKET' })
    pdf6.save('Test_06_Mixto_Ticket.pdf')
    console.log('   ✓ PDF generado: Test_06_Mixto_Ticket.pdf')
  } catch (error) {
    console.error('   ✗ Error:', error)
  }

  console.log('\n📦 Se generaron 6 PDFs de prueba en la carpeta de Descargas')
  console.log('🔍 Revisa cada PDF para verificar:')
  console.log('   • Formato correcto (A4 o TICKET)')
  console.log('   • Datos opcionales muestran líneas si no existen')
  console.log('   • Montos en S/ con 2 decimales')
  console.log('   • Presentaciones se muestran entre paréntesis')
  console.log('   • No hay referencias a "BOLETA ELECTRÓNICA" o "SUNAT"')
  
  console.groupEnd()
}

/**
 * Prueba individual para debugging
 */
export function testSinglePDF(format: 'A4' | 'TICKET' = 'A4') {
  console.log(`🧪 Generando PDF de prueba individual (${format})...`)
  
  try {
    const pdf = generateSalePDF(testSaleComplete, { format })
    pdf.save(`Test_Individual_${format}.pdf`)
    console.log(`✓ PDF generado: Test_Individual_${format}.pdf`)
  } catch (error) {
    console.error('✗ Error:', error)
  }
}

// Si se ejecuta directamente en el navegador
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.testPDFGenerator = testPDFGenerator
  // @ts-ignore
  window.testSinglePDF = testSinglePDF
  
  console.log('🚀 Funciones de prueba cargadas en window:')
  console.log('   • testPDFGenerator() - Ejecuta todas las pruebas')
  console.log('   • testSinglePDF("A4") - Prueba individual A4')
  console.log('   • testSinglePDF("TICKET") - Prueba individual TICKET')
}
