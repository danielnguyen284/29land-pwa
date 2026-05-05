import bcrypt from "bcryptjs";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/User";

export async function seedAdmin() {
  const userRepo = AppDataSource.getRepository(User);

  const existing = await userRepo.findOneBy({ role: UserRole.ADMIN });
  if (existing) {
    console.log("Admin account already exists, skipping seed.");
    return;
  }

  const phone = process.env.ADMIN_PHONE || "0900000000";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 10);

  const admin = userRepo.create({
    role: UserRole.ADMIN,
    name: "Admin",
    phone,
    password_hash: hash,
  });

  await userRepo.save(admin);
  console.log(`Admin account seeded (phone: ${phone})`);
}
