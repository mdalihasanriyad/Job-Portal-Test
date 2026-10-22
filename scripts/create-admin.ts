import './loadEnv.js';
import readline from 'node:readline';
import { closeDb, col, getDb } from '../api/_lib/db.js';
import { ensureIndexes } from '../api/_lib/indexes.js';
import { checkPasswordStrength, hashPassword } from '../api/_lib/password.js';

// Usage: npm run create-admin            (prompts for everything)
//        npm run create-admin -- --email you@example.com --name "Your Name"

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const writer = rl as unknown as { _writeToOutput: (text: string) => void; output: NodeJS.WriteStream };
      writer._writeToOutput = (text: string) => {
        if (text.startsWith(question)) writer.output.write(text);
        else if (text.trim() === '') writer.output.write(text);
        else writer.output.write('*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const email = (argValue('email') ?? (await ask('Admin email: '))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid email address.');
  const name = (argValue('name') ?? (await ask('Display name (optional): '))).trim().slice(0, 80);

  const password = await ask('Password (min 12 chars, letters + digits): ', true);
  const problem = checkPasswordStrength(password, email);
  if (problem) throw new Error(problem);
  const confirm = await ask('Confirm password: ', true);
  if (confirm !== password) throw new Error('Passwords do not match.');

  const db = await getDb();
  await ensureIndexes(db);
  if (await col.admins(db).findOne({ email })) throw new Error(`An admin with email ${email} already exists.`);

  await col.admins(db).insertOne({
    email,
    ...(name ? { name } : {}),
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
  });
  console.log(`Admin created: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error('Could not create admin:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
