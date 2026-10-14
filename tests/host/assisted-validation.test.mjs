import assert from "node:assert/strict";
import { test } from "node:test";
import { assistedConfirmationSchema } from "../../lib/host/assisted/validation.ts";
import { safeNext } from "../../lib/auth/validation.ts";
test("assisted host must choose pricing and capacity instead of accepting storage defaults", () => {
  const valid = { price: "300", pricingMode: "private_group", maxGuests: "4", copyApproved: "on" };
  assert.equal(assistedConfirmationSchema.parse(valid).price, 30000);
  for (const patch of [
    { pricingMode: "" },
    { maxGuests: "" },
    { maxGuests: "0" },
    { maxGuests: "51" },
    { copyApproved: undefined },
    { price: "0" },
  ])
    assert.equal(assistedConfirmationSchema.safeParse({ ...valid, ...patch }).success, false);
  assert.equal(safeNext("/host/welcome"), "/host/welcome");
  assert.equal(safeNext("/host/welcome?next=https://bad.example"), "/account/dashboard");
});
