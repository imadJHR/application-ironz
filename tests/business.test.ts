import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  documentSchema,
  invoiceStatus,
  lineSchema,
} from "../src/lib/business";
import { paymentSchema } from "../src/server/validation";
import { hashPassword, verifyPassword } from "../src/server/password";
import { allowed } from "../src/lib/permissions";
import { montantEnLettres } from "../src/lib/lettres";
test("roles follow the commercial and accounting access matrix", () => {
  assert.equal(allowed("COMMERCIAL", "sales"), true);
  assert.equal(allowed("COMMERCIAL", "invoice"), true);
  assert.equal(allowed("COMMERCIAL", "finance"), false);
  assert.equal(allowed("COMPTABILITE", "sales"), false);
  assert.equal(allowed("COMPTABILITE", "invoice"), true);
  assert.equal(allowed("COMPTABILITE", "finance"), true);
  assert.equal(allowed("ADMIN", "admin"), true);
  assert.equal(allowed("COMPTABILITE", "read"), true);
});
test("mixed VAT rates and discounts are rounded per line", () => {
  const total = calculate([
    { quantity: 3, unitPrice: 19.99, discountRate: 10, taxRate: 20 },
    { quantity: 2, unitPrice: 100, discountRate: 0, taxRate: 10 },
  ]);
  assert.equal(total.subtotal, "259.97");
  assert.equal(total.discount, "6.00");
  assert.equal(total.totalHT, "253.97");
  assert.equal(total.totalTax, "30.79");
  assert.equal(total.totalTTC, "284.76");
});
test("decimal arithmetic avoids binary rounding errors", () => {
  assert.equal(
    calculate([{ quantity: 3, unitPrice: 0.1, discountRate: 0, taxRate: 20 }])
      .totalTTC,
    "0.36",
  );
  assert.equal(
    calculate([{ quantity: 1, unitPrice: 0.05, discountRate: 0, taxRate: 10 }])
      .totalTax,
    "0.01",
  );
});
test("quantity precision and full discounts are supported", () => {
  assert.ok(
    lineSchema.safeParse({
      name: "Service",
      quantity: 1.001,
      unitPrice: 10.01,
      discountRate: 100,
      taxRate: 20,
    }).success,
  );
  assert.equal(
    calculate([
      { quantity: 10, unitPrice: 100, discountRate: 100, taxRate: 20 },
    ]).totalTTC,
    "0.00",
  );
});
test("invalid and over-precision monetary values are rejected", () => {
  for (const unitPrice of [-1, Infinity, NaN, 1.234])
    assert.equal(
      lineSchema.safeParse({
        name: "Article",
        quantity: 1,
        unitPrice,
        discountRate: 0,
        taxRate: 20,
      }).success,
      false,
    );
  assert.equal(
    paymentSchema.safeParse({
      idempotencyKey: "12345678-1234-4234-9234-123456789012",
      invoiceId: "x",
      date: "2026-10-07",
      amount: 1.001,
      method: "Virement",
    }).success,
    false,
  );
});
test("document validation rejects backwards deadlines", () => {
  assert.equal(
    documentSchema.safeParse({
      kind: "QUOTE",
      clientId: "x",
      date: "2026-10-07",
      dueDate: "2026-10-06",
      items: [
        {
          name: "Article",
          quantity: 1,
          unitPrice: 100,
          discountRate: 0,
          taxRate: 20,
        },
      ],
    }).success,
    false,
  );
});
test("invoice payment state is derived from actual balance and due date", () => {
  const future = new Date(Date.now() + 86400000),
    past = new Date(Date.now() - 86400000);
  assert.equal(invoiceStatus("120", "0", future), "SENT");
  assert.equal(invoiceStatus("120", "20", future), "PARTIAL");
  assert.equal(invoiceStatus("120", "120", past), "PAID");
  assert.equal(invoiceStatus("120", "20", past), "OVERDUE");
  assert.equal(invoiceStatus("120", "0", past, "DRAFT"), "DRAFT");
  assert.equal(invoiceStatus("120", "0", past, "CANCELLED"), "CANCELLED");
});
test("password hashes are salted and verified in constant time", async () => {
  const password = "a-long-private-test-password",
    a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(await verifyPassword(password, a));
  assert.equal(await verifyPassword("wrong-password", a), false);
});
test("montants en lettres (français traditionnel)", () => {
  assert.equal(montantEnLettres(0), "zéro DIRHAM");
  assert.equal(montantEnLettres(1), "un DIRHAM");
  assert.equal(montantEnLettres(21), "vingt et un DIRHAMS");
  assert.equal(montantEnLettres(71), "soixante et onze DIRHAMS");
  assert.equal(montantEnLettres(80), "quatre-vingts DIRHAMS");
  assert.equal(montantEnLettres(81), "quatre-vingt-un DIRHAMS");
  assert.equal(montantEnLettres(100), "cent DIRHAMS");
  assert.equal(montantEnLettres(201), "deux cent un DIRHAMS");
  assert.equal(montantEnLettres(1000), "mille DIRHAMS");
  assert.equal(montantEnLettres(80000), "quatre-vingt mille DIRHAMS");
  assert.equal(
    montantEnLettres(158112),
    "cent cinquante-huit mille cent douze DIRHAMS",
  );
  assert.equal(
    montantEnLettres(999.5),
    "neuf cent quatre-vingt-dix-neuf DIRHAMS ET cinquante CENTIMES",
  );
  assert.equal(montantEnLettres(999), "neuf cent quatre-vingt-dix-neuf DIRHAMS");
});
