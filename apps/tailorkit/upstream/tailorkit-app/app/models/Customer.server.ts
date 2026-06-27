import mongoose from '~/bootstrap/db/connect-db.server'

/**
 * The following schema is a reflection of the Shopify customer data structure sent by order related webhooks.
 *
 * @see https://shopify.dev/docs/api/admin-rest/2024-01/resources/webhook
 */
export const AddressSchema = {
  id: Number,
  customer_id: Number,
  first_name: String,
  last_name: String,
  company: String,
  address1: String,
  address2: String,
  city: String,
  province: String,
  country: String,
  zip: String,
  phone: String,
  name: String,
  province_code: String,
  country_code: String,
  country_name: String,
  default: Boolean,
}

const CustomerSchema = new mongoose.Schema(
  {
    id: Number,
    email: String,
    created_at: String,
    updated_at: String,
    first_name: String,
    last_name: String,
    state: String,
    note: mongoose.SchemaTypes.Mixed,
    verified_email: Boolean,
    multipass_identifier: mongoose.SchemaTypes.Mixed,
    tax_exempt: Boolean,
    phone: mongoose.SchemaTypes.Mixed,
    email_marketing_consent: {
      state: String,
      opt_in_level: mongoose.SchemaTypes.Mixed,
      consent_updated_at: String,
    },
    sms_marketing_consent: mongoose.SchemaTypes.Mixed,
    tags: String,
    currency: String,
    tax_exemptions: mongoose.SchemaTypes.Mixed,
    admin_graphql_api_id: String,
    default_address: AddressSchema,
    // The shop domain that owns the customer
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { timestamps: true }
)

const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema)

export default Customer
