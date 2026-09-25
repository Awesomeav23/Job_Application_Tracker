"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Regression test for the AI-003 provenance guarantee on analyses.documentId.
 *
 * Asserts:
 *   1. A document cited by an analysis CANNOT be deleted (P2003). This is the
 *      guarantee AI-003 depends on, and what makes archiving necessary.
 *   2. Deleting a user still works, so test teardown and account deletion are
 *      not blocked by that guard.
 *
 * Historical note: this file was written to prove that RESTRICT caused an
 * order-dependent failure on user deletion. It disproved it. Both RESTRICT and
 * NoAction were tested under both constraint-creation orders and behaved
 * identically — Postgres only distinguishes them for DEFERRABLE constraints,
 * which Prisma does not generate. The test is kept for assertion 1, which is
 * real and worth guarding.
 *
 * Run:  npx ts-node prisma/verify-cascade.ts
 */
const client_1 = require("@prisma/client");
const db = new client_1.PrismaClient();
async function fixture(tag) {
    await db.user.create({
        data: {
            id: `u-${tag}`,
            email: `${tag}@example.com`,
            passwordHash: 'not-a-real-hash',
            documents: {
                create: {
                    id: `d-${tag}`,
                    kind: 'RESUME',
                    label: 'Software Engineer Resume v4',
                    storageKey: `key-${tag}`,
                    originalFileName: 'resume-v4.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 184320,
                },
            },
        },
    });
    await db.application.create({
        data: {
            id: `a-${tag}`,
            userId: `u-${tag}`,
            company: 'Lennar',
            jobTitle: 'Software Engineer I',
            jobDescription: 'We are seeking a Software Engineer I...',
            status: 'APPLIED',
            resumeId: `d-${tag}`,
        },
    });
    await db.analysis.create({
        data: {
            id: `an-${tag}`,
            userId: `u-${tag}`,
            applicationId: `a-${tag}`,
            documentId: `d-${tag}`,
            matchScore: 72,
            summary: 'Strong backend alignment.',
            strengths: ['REST API design'],
            missingSkills: ['Kubernetes'],
            relevantExperience: ['Full-stack tracker'],
            provider: 'MOCK',
            modelId: 'mock-v1',
            promptVersion: 'v1',
        },
    });
}
async function setAction(action) {
    await db.$executeRawUnsafe(`ALTER TABLE "analyses" DROP CONSTRAINT "analyses_documentId_fkey"`);
    await db.$executeRawUnsafe(`ALTER TABLE "analyses" ADD CONSTRAINT "analyses_documentId_fkey" ` +
        `FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE ${action} ON UPDATE CASCADE`);
}
async function attempt(label, fn) {
    try {
        await fn();
        console.log(`  ${label}\n    → SUCCEEDED`);
        return 'ok';
    }
    catch (e) {
        const msg = String(e.message ?? e).split('\n').filter((l) => l.trim()).slice(-1)[0];
        const code = e.meta?.code ?? e.code ?? '';
        console.log(`  ${label}\n    → FAILED  ${code}  ${msg.trim().slice(0, 90)}`);
        return 'err';
    }
}
async function wipe() {
    await db.analysis.deleteMany({});
    await db.application.deleteMany({});
    await db.document.deleteMany({});
    await db.user.deleteMany({});
}
async function main() {
    const results = {};
    await wipe();
    await setAction('NO ACTION');
    console.log('\n─── A. NoAction (the fix as shipped) ───────────────────────');
    await fixture('a');
    results.directDelete = await attempt('DELETE the resume that an analysis cites  (AI-003 must refuse this)', () => db.document.delete({ where: { id: 'd-a' } }));
    results.userDeleteNoAction = await attempt('DELETE the user  (cascades to documents AND analyses at once)', () => db.user.delete({ where: { id: 'u-a' } }));
    console.log('\n─── B. Restrict (the alternative — for the record) ─────────');
    await wipe();
    await setAction('RESTRICT');
    await fixture('b');
    results.userDeleteRestrict = await attempt('DELETE the same user, identical data, only the FK action differs', () => db.user.delete({ where: { id: 'u-b' } }));
    await wipe();
    await setAction('NO ACTION');
    console.log('\n─── Verdict ───────────────────────────────────────────────');
    const pass = (c) => (c ? 'PASS' : 'FAIL');
    console.log(`  AI-003 still refuses a direct delete of a cited resume   ${pass(results.directDelete === 'err')}`);
    console.log(`  User delete succeeds with NoAction                       ${pass(results.userDeleteNoAction === 'ok')}`);
    console.log(`  Restrict behaves identically (no ordering hazard)       ${pass(results.userDeleteRestrict === 'ok')}`);
    console.log('\n  Constraint restored to NO ACTION.\n');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
