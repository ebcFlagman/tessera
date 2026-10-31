import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const platform = await db.product.upsert({
    where: { name: 'Plattform' },
    update: {},
    create: { name: 'Plattform', description: 'Beispielprodukt (Testdaten)' },
  });
  const shop = await db.product.upsert({
    where: { name: 'Webshop' },
    update: {},
    create: { name: 'Webshop', description: 'Beispielprodukt (Testdaten)' },
  });

  // subjects equal the fixed user ids in deploy/keycloak/tessera-realm.json
  const users = [
    {
      subject: '00000000-0000-4000-8000-000000000001',
      name: 'Ada Admin',
      email: 'admin@example.test',
    },
    {
      subject: '00000000-0000-4000-8000-000000000002',
      name: 'Eddi Editor',
      email: 'editor@example.test',
    },
    {
      subject: '00000000-0000-4000-8000-000000000003',
      name: 'Nora Ohnerolle',
      email: 'norole@example.test',
    },
  ];
  const created = [];
  for (const u of users) {
    created.push(await db.user.upsert({ where: { subject: u.subject }, update: u, create: u }));
  }
  const [admin, editor] = created;
  for (const product of [platform, shop]) {
    await db.membership.upsert({
      where: { userId_productId: { userId: admin!.id, productId: product.id } },
      update: { role: 'admin' },
      create: { userId: admin!.id, productId: product.id, role: 'admin' },
    });
  }
  await db.membership.upsert({
    where: { userId_productId: { userId: editor!.id, productId: platform.id } },
    update: { role: 'editor' },
    create: { userId: editor!.id, productId: platform.id, role: 'editor' },
  });

  const team = await db.team.upsert({
    where: { name: 'Team Alpha' },
    update: {},
    create: { name: 'Team Alpha' },
  });
  await db.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: editor!.id } },
    update: {},
    create: { teamId: team.id, userId: editor!.id },
  });
}

main().finally(() => db.$disconnect());
