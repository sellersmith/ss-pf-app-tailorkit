/**
 * Fetch all publications (sales channels + Markets catalogs) on the shop.
 * `first: 250` is Shopify's max page size; shops rarely exceed this in practice,
 * so pagination is omitted for simplicity.
 */
export const getStorePublicationsQuery = `#graphql
    query GetStorePublications {
        publications(first: 250) {
            edges {
                node {
                    id
                    name
                }
            }
        }
    }
`
