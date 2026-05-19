export type LeadInput = {
  customerName?: string;
  phone?: string;
  city?: string;
  description?: string;
  serviceId?: string;
};

export type ValidatedLeadInput = {
  customerName: string;
  phone: string;
  city: string;
  description?: string;
  serviceId: string;
};

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function validateLeadInput(input: LeadInput):
  | { ok: true; data: ValidatedLeadInput }
  | { ok: false; error: string } {
  const customerName = input.customerName?.trim();
  const phone = normalizePhone(input.phone?.trim() ?? "");
  const city = input.city?.trim();
  const description = input.description?.trim();
  const serviceId = input.serviceId?.trim();

  if (!customerName) {
    return { ok: false, error: "Name is required." };
  }
  if (customerName.length > 100) {
    return { ok: false, error: "Name must be 100 characters or less." };
  }
  if (!phone) {
    return { ok: false, error: "Phone number is required." };
  }
  if (!/^[0-9]{10,15}$/.test(phone)) {
    return { ok: false, error: "Enter a valid phone number (10-15 digits)." };
  }
  if (!city) {
    return { ok: false, error: "City is required." };
  }
  if (city.length > 100) {
    return { ok: false, error: "City must be 100 characters or less." };
  }
  if (!serviceId) {
    return { ok: false, error: "Service is required." };
  }
  if (description && description.length > 500) {
    return { ok: false, error: "Description must be 500 characters or less." };
  }

  return {
    ok: true,
    data: {
      customerName,
      phone,
      city,
      description: description || undefined,
      serviceId,
    },
  };
}
