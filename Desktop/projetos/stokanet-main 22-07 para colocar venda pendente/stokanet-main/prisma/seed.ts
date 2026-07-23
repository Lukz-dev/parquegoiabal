import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Criar empresa principal
  const company = await prisma.company.upsert({
    where: { id: 'company-demo-1' },
    update: {},
    create: {
      id: 'company-demo-1',
      name: 'Aurora Comercio LTDA',
      defaultMinStock: 5,
    },
  })
  console.log(`✅ Empresa criada: ${company.name}`)

  // Criar usuário administrador
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@auroracomercio.com' },
    update: {
      isApproved: true,
      isSystemAdmin: true,
      role: 'ADMIN',
    },
    create: {
      email: 'admin@auroracomercio.com',
      name: 'Administrador',
      password: hashedPassword,
      role: 'ADMIN',
      isApproved: true,
      isSystemAdmin: true,
      companyId: company.id,
    },
  })
  console.log(`✅ Usuário Admin criado: ${adminUser.email}`)

  // Criar categorias demo
  await prisma.category.upsert({
    where: { id: 'cat-1' },
    update: {},
    create: { id: 'cat-1', name: 'Vestuário', companyId: company.id },
  })
  const catAcessorios = await prisma.category.upsert({
    where: { id: 'cat-2' },
    update: {},
    create: { id: 'cat-2', name: 'Acessórios', companyId: company.id },
  })
  const catCasa = await prisma.category.upsert({
    where: { id: 'cat-3' },
    update: {},
    create: { id: 'cat-3', name: 'Casa e utilidades', companyId: company.id },
  })
  console.log(`✅ Categorias criadas`)

  // Criar produtos demo
  const products = [
    { id: 'prod-1', name: 'Caixa Organizadora 20L', sku: 'CAI-001', size: '20 L', color: 'Transparente', price: 79.9, stockQty: 120, minStock: 20, status: 'Normal', categoryId: catCasa.id },
    { id: 'prod-2', name: 'Copo Térmico Inox 500ml', sku: 'COP-002', size: '500 ml', color: 'Preto', price: 189.9, stockQty: 15, minStock: 20, status: 'Baixo', categoryId: catAcessorios.id },
    { id: 'prod-3', name: 'Kit Canetas Marca Texto', sku: 'CAN-001', size: '6 un', color: 'Colorido', price: 249.9, stockQty: 45, minStock: 10, status: 'Normal', categoryId: catCasa.id },
    { id: 'prod-4', name: 'Prateleira Metálica Modular', sku: 'PRA-001', size: '120 cm', color: 'Cinza', price: 229.9, stockQty: 210, minStock: 30, status: 'Normal', categoryId: catCasa.id },
    { id: 'prod-5', name: 'Caixa de Ferramentas Compacta', sku: 'FER-005', size: '14 pol', color: 'Azul', price: 149.9, stockQty: 4, minStock: 10, status: 'Crítico', categoryId: catAcessorios.id },
    { id: 'prod-6', name: 'Jogo de Potes Herméticos', sku: 'POT-016', size: '4 peças', color: 'Branco', price: 329.9, stockQty: 0, minStock: 15, status: 'Esgotado', categoryId: catCasa.id },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, companyId: company.id },
    })
  }
  console.log(`✅ ${products.length} produtos criados`)

  console.log('\n🎉 Seed finalizado com sucesso!')
  console.log('📧 Login: admin@auroracomercio.com')
  console.log('🔑 Senha: admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
