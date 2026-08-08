import { eq } from "drizzle-orm";
import { index, pool } from "./db";
import { demoUsers } from "./schema";

async function main() {
  try {
    console.log("Performing CRUD operations...");

    const [newUser] = await index
      .insert(demoUsers)
      .values({ name: "Admin User", email: "admin@example.com" })
      .returning();

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    console.log("CREATE: New user created:", newUser);

    const foundUser = await index.select().from(demoUsers).where(eq(demoUsers.id, newUser.id));
    console.log("READ: Found user:", foundUser[0]);

    const [updatedUser] = await index
      .update(demoUsers)
      .set({ name: "Super Admin" })
      .where(eq(demoUsers.id, newUser.id))
      .returning();

    if (!updatedUser) {
      throw new Error("Failed to update user");
    }

    console.log("UPDATE: User updated:", updatedUser);

    await index.delete(demoUsers).where(eq(demoUsers.id, newUser.id));
    console.log("DELETE: User deleted.");

    console.log("\nCRUD operations completed successfully.");
  } catch (error) {
    console.error("Error performing CRUD operations:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log("Database pool closed.");
  }
}

main();