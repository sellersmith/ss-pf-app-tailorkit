/**
 * @description Create delivery profile
 * @example
 * {
    "profile": {
        "name": "Pre-orders free shipping1",
        "locationGroupsToCreate": {
        "locations": ["gid://shopify/Location/79612379381"],
        "zonesToCreate": {
            "name": "All Countries",
            "countries": { "restOfWorld": true },
            "methodDefinitionsToCreate": {
            "name": "TailorKit Shipping",
            "rateDefinition": {
                "price": { "amount": 20, "currencyCode": "USD" }
            }
            }
        }
        }
    }
    }
 */
export const deliveryProfileCreate = `#graphql
    mutation deliveryProfileCreate($profile: DeliveryProfileInput!) {
        deliveryProfileCreate(profile: $profile) {
            profile {
                id
                name
            }
            userErrors {
                field
                message
            }
        }
    }
`

/**
 * @description Update delivery profile
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/deliveryProfileUpdate
 */
export const deliveryProfileUpdate = `#graphql
    mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
        deliveryProfileUpdate(id: $id, profile: $profile) {
            profile {
                id
                name
            }
            userErrors {
                field
                message
            }
        }
}
`

/**
 * @description Remove delivery profile
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/deliveryProfileRemove
 */
export const deliveryProfileRemove = `#graphql
    mutation deliveryProfileRemove($id: ID!) {
        deliveryProfileRemove(id: $id) {
            job {
                id
                done
            }
            userErrors {
                field
                message
            }
        }
    }
`
