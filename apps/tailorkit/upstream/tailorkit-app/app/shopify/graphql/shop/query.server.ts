// Query shop information (name, description, first 10 metafields)
export const SHOP_INFO_QUERY = `#graphql
 {
   shop {
     name
     description
     metafields(first: 10) {
       edges {
         node {
           namespace
           key
           value
         }
       }
     }
   }
 }
`
