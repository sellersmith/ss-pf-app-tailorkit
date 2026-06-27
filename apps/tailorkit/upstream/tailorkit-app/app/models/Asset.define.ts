/* eslint-disable max-len */
/* eslint-disable max-lines */

// Define built-in overlays
const overlays = [
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Small_-_Black_Zipper_-_Back_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Small_-_Black_Zipper_-_Front_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Small_-_White_Zipper_-_Front_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Large_-_White_Zipper_-_Back_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Large_-_Black_Zipper_-_Back_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Large_-_White_Zipper_-_Front_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Large_-_Black_Zipper_-_Front_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Small_-_White_zipper_-_Back_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_-_Small_-_White_Zipper_-_Back_-_Overlay.webp?v=1743383901',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Small_-_Black_zipper_-_Back_-_Overlay.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Women_s_Cut_Sew_Tee_AOP_-_Front_-_Overlay_ee5a5739-9bfd-4d8b-bf43-471070cc13ff.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Small_-_Black_zipper_-_Front_-_Overlay.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Small_-_White_zipper_-_Front_-_Overlay.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_-_Glossy_-_Context_-_Overlay_d3a79d88-90a0-4ade-bb9f-cd0097f9cde5.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Large_-_White_zipper_-_Front_-_Overlay.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Large_-_White_zipper_-_Back_-_Overlay.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Weekender_Bag_-_Front_-_Overlay_97949a37-4018-46e0-b680-54a22439ae93.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_Plus_-_Glossy_-_Context_-_Overlay_48859f03-22ef-4ab4-aad5-43fdbef490ce.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_-_Matte_-_Context_-_Overlay_f94434cc-44c1-4ef6-b6a7-51d12c569228.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Weekender_Bag_-_Back_-_Overlay_1dc07364-da21-475e-8f38-25ad98e2aad4.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Clutch_Bag_-_Back_-_Overlay_ef031cdf-657b-4c2b-8dcb-39e7bb4ab827.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Unisex_Cut_Sew_Tee_AOP_-_Back_-_Overlay_8c163d6a-498b-4490-82f9-42a8f6c0f45d.webp?v=1743383900',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_13_Pro_Max_-_Front_-_Overlay.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_Pro_-_Glossy_-_Front_-_Overlay_7ff412cf-1cd4-4346-b834-cc2e1ab46e32.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_Ultra_-_Matte_-_Front_-_Overlay_7a49b5f8-bfe1-4572-b43c-9a76bdf8375b.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Clutch_Bag_-_Context_2_-_Overlay_e578f742-7ca3-4d84-afdd-5e5de26f3975.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_-_Glossy_-_Front_-_Overlay_98307758-8d85-4699-8314-9fd9be6e0f11.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Unisex_Cut_Sew_Tee_AOP_-_Front_-_Overlay_10d5e0a8-d8fc-426b-a81f-ba87b6962c21.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_Plus_-_Glossy_-_Front_-_Overlay_033e73bc-23cd-4d0a-9d35-39734d2b3e76.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_-_Matte_-_Front_-_Overlay_33a76e0a-4e67-4543-ad90-bc989400b92c.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_FE_-_Glossy_-_Front_-_Overlay_9296cf84-9dfe-44fb-bf33-559a750b9abc.webp?v=1743383899',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_Plus_-_Glossy_-_Context_-_Overlay_e14e03b8-a772-4479-a139-2da2734e3cc2.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_14_Pro_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_Samsung_Galaxy_S24_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_-_Glossy_-_Context_-_Overlay_142ec38f-22c1-4303-92d9-9c1fe23fc523.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_Samsung_Galaxy_S23_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_13_Mini_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_Pro_Max_-_Glossy_-_Context_-_Overlay_363ce052-a27f-4348-a238-48dcbde210b9.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_Samsung_Galaxy_S22_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_Pro_Max_-_Glossy_-_Context_-_Overlay_c76f1bd9-7202-4047-affd-8dc9aaf3cd9b.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_13_Pro_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_13_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_Pro_-_Matte_-_Context_-_Overlay_02f3f78e-946c-4731-ab33-44f0f8ee59a2.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_14_Pro_Max_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_7_-_Glossy_-_Front_-_Overlay_ef20bc0c-1e5f-49ec-9de3-aa75058e7c87.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_15_Pro_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_Pro_Max_-_Matte_-_Context_-_Overlay_b7fe8034-1568-48b0-a9c7-eb622d5862f0.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_Plus_-_Glossy_-_Front_-_Overlay_a18cba37-b923-4893-ba3f-eca73dc87d37.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_Pro_-_Glossy_-_Context_-_Overlay_27437dc6-142c-4699-9a30-f20306be7beb.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_Plus_-_Matte_-_Context_-_Overlay_6a6ba1d3-7dbb-4f20-8a08-e4f061b65412.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S22_-_Glossy_-_Front_-_Overlay_0234ebe7-c092-497d-80d6-3c89739a5c47.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_15_Plus_-_Matte_-_Context_-_Overlay_a3d50d19-5e5b-474c-817f-7aaa4e455107.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tote_Bag_AOP_-_Red_Handle_-_Front_-_Overlay_fa1f386f-1ac5-44ae-b8b0-781e1faceb2f.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_12_Pro_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_-_Matte_-_Context_-_Overlay_3c892e29-d431-4c87-9bf4-cf3f731bb997.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_Pro_-_Glossy_-_Context_-_Overlay_af72e44b-72d1-4925-94af-16f86da1e1c3.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_15_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_Pro_Max_-_Glossy_-_Context_-_Overlay_17703c93-4bcd-4bfd-85f5-05c98768da77.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_Pro_Max_-_Matte_-_Context_-_Overlay_d9f980ee-acf7-4aeb-9b69-46e41dee72f4.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_-_Matte_-_Front_-_Overlay_64bb5cf1-696c-480e-a63e-bf40119ea2c8.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Large_-_Black_zipper_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_-_Matte_-_Front_-_Overlay_02982d58-ce87-4b5c-abbd-db3baa79c81a.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_11_Pro_Max_-_Front_-_Overlay.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_Plus_-_Matte_-_Front_-_Overlay_62bc0ca6-3d19-4d0c-a0ef-cdebc05bda5b.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_16_Pro_-_Matte_-_Context_-_Overlay_da314c1f-e189-4606-bfe0-271e9d3bce62.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_Pro_Max_-_Matte_-_Context_-_Overlay_3f6c714f-0c7a-429d-89d1-726942cb9260.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_Pro_-_Matte_-_Front_-_Overlay_68c55c17-bf5f-4c4f-9add-ee83337d44d0.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Accessory_Pouch_w_T-bottom_-_Large_-_Black_zipper_-_Back_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_Pro_Max_-_Matte_-_Front_-_Overlay_06006219-edf4-4b8d-aaa2-27212434e780.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_12_Pro_Max_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_-_Glossy_-_Front_-_Overlay_1408ed76-6c6c-4a2f-823d-283603d841ac.webp?v=1743383898',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_Ultra_-_Glossy_-_Front_-_Overlay_a40ce08c-a708-4053-ad1a-87412f120160.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tote_Bag_AOP_-_Black_Handle_-_Front_-_Overlay_03cae18a-471c-4d80-99eb-9f7eaced5c9c.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tote_Bag_AOP_-_Beige_Handle_-_Front_-_Overlay_66151c75-d3af-4fc3-ab06-b76110163a4c.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_Plus_-_Matte_-_Context_-_Overlay_a6219c6c-f6b3-4b62-a398-89c722aa804a.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_14_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Clutch_Bag_-_Front_-_Overlay_18ff6448-fe54-42d1-9544-c396c602b7af.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_12_Mini_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_12_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_14_Plus_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tote_Bag_AOP_-_Navy_Handle_-_Front_-_Overlay_6475fc63-3916-4643-a119-766f518102d8.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_Samsung_Galaxy_S21_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tote_Bag_AOP_-_White_Handle_-_Front_-_Overlay_2a220563-f62b-4801-ae6f-6033ee60594c.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S25_-_Matte_-_Front_-_Overlay_d9d03cae-f6d5-4303-babc-401e2a00b06e.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_Pro_Max_-_Glossy_-_Front_-_Overlay_d6a8718e-5c6d-4553-a7da-1a5b6d79afe7.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_16_Plus_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_15_Pro_Max_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_16_Pro_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_15_Plus_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_Mini_-_Matte_-_Front_-_Overlay_efd0d344-8e2b-4999-a62f-c448dc482ce3.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S23_-_Matte_-_Front_-_Overlay_f0919dfa-6184-4bba-a1cf-057dd9d342a6.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_5_5G_-_Glossy_-_Front_-_Overlay_66552abd-df39-44db-a2cd-eef3428ddf31.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_16_-_Front_-_Overlay.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_FE_-_Matte_-_Front_-_Overlay_597feb96-abcd-4938-b68b-d59c310b7d90.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_16_Pro_Max_-_Front_-_Overlay.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S25_Ultra_-_Matte_-_Front_-_Overlay_b6aec02d-64ec-484c-9efe-d29e6f0759b0.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_Plus_-_Matte_-_Front_-_Overlay_108667ca-3238-4fc3-b8ea-887e546cd2ce.webp?v=1743383897',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_Plus_-_Glossy_-_Context_-_Overlay_431dfb02-c0a8-4fc7-b612-469d3a65dd12.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_Mini_-_Glossy_-_Front_-_Overlay_94f3df4e-df54-4769-bc60-26fd80428df3.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S23_-_Glossy_-_Front_-_Overlay_97c6f4fc-b07c-4dd1-925c-4deb5fe44865.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_Mini_-_Glossy_-_Front_-_Overlay_d9180d33-15f0-4e72-b1bd-696ba2a01b36.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_Pro_-_Matte_-_Context_-_Overlay_255c5ebe-4435-46a6-9a36-ae108a9f1664.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_-_Glossy_-_Context_-_Overlay_25c4cd2b-1e9e-4708-ad1c-41a66a697946.webp?v=1743383896',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_-_Matte_-_Context_-_Overlay_648b225b-b318-4e5a-b69c-2369b867cf07.webp?v=1743383895',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_14_Pro_-_Glossy_-_Context_-_Overlay_56539296-85bf-4ceb-8f77-81f9fd0b6fe4.webp?v=1743383895',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S23_Plus_-_Glossy_-_Front_-_Overlay_eeb9a9a3-3e7b-45ee-9bd0-976cf9b0984c.webp?v=1743383895',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/T-Shirt_Dress_AOP_-_Back_-_Overlay_33aab486-9e70-40c7-ac3a-282f73e8506b.webp?v=1743383895',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/T-Shirt_Dress_AOP_-_Front_-_Overlay_48a16d23-09ed-48b7-a54d-8f00ec384f82.webp?v=1743383894',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_Pro_Max_-_Matte_-_Context_-_Overlay_adb8c8ea-c7a0-4f80-8e95-a10ca4ed7aba.webp?v=1743383893',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_Pro_Max_-_Glossy_-_Front_-_Overlay_b0b36e98-0ba1-44d2-b771-2cc3931db7e8.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Mini_Clutch_Bag_-_Back_-_Overlay_59caee23-f4bd-4d35-aef8-4912c1aebaf5.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_Pro_Max_-_Matte_-_Front_-_Overlay_2bf4867b-f92d-4f25-b9f8-de3bb79a50d9.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Mini_Clutch_Bag_-_Front_-_Overlay_e631bdb1-5ab3-4738-82ce-091b8561ac97.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_Pro_-_Glossy_-_Front_-_Overlay_4d7923fb-bd4b-4f53-9398-f97184be821c.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_Pro_Max_-_Matte_-_Front_-_Overlay_37c3bb58-c987-4a4b-904b-0e4a8ff780f3.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S22_-_Matte_-_Front_-_Overlay_e3bb6c62-b1bc-494b-8e8c-d32bbeb4f278.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_Pro_Max_-_Glossy_-_Front_-_Overlay_83bce7fc-6411-45c8-ae5d-78c7c33521d1.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_-_Matte_-_Front_-_Overlay_41f38bcf-3cea-439c-a8ab-589fca496b06.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S22_Plus_-_Matte_-_Front_-_Overlay_89b4da6f-920c-4d54-8a27-80dfc0dd89d2.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S22_Plus_-_Glossy_-_Front_-_Overlay_db087be1-0a84-4d89-bddb-200be8f58607.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_Pro_-_Matte_-_Front_-_Overlay_66251c71-6acd-4dcf-a043-a6c1c0a5087b.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_Pro_-_Glossy_-_Front_-_Overlay_39644012-7d14-4ff9-b667-2e489d430f4f.webp?v=1743383892',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_-_Glossy_-_Front_-_Overlay_525dbb1b-421c-471e-a25b-dd759d85e895.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S22_Ultra_-_Matte_-_Front_-_Overlay_d0559816-4393-4f15-8b8c-7c76709a6d48.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_11_-_Front_-_Overlay.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_-_Matte_-_Front_-_Overlay_bc825bae-dad3-4a84-97bd-0c3258e1d384.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S22_Ultra_-_Glossy_-_Front_-_Overlay_8a29a882-cf10-413e-9c57-aa44ed6e3284.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Phone_Cases_-_iPhone_11_Pro_-_Front_-_Overlay.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_Plus_-_Matte_-_Front_-_Overlay_a9faf657-8e49-4296-a193-047f783b3bd2.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_13_Pro_-_Matte_-_Front_-_Overlay_a5d15af0-67e5-4af4-acfa-794d3499498a.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_12_Mini_-_Matte_-_Front_-_Overlay.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S25_-_Glossy_-_Front_-_Overlay_8370f679-6c11-4cd7-b7ae-b554d46a4bf4.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S23_Plus_-_Matte_-_Front_-_Overlay_448133d9-901c-41b5-a42e-1320a6c47d72.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S24_-_Matte_-_Front_-_Overlay_1e826b44-b460-490f-a919-a0446a308a69.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_Pro_Max_-_Glossy_-_Front_-_Overlay_3395ecfc-8a9b-4098-8e6e-d3bff31379f0.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_-_Glossy_-_Front_-_Overlay_c0ef835e-4b3f-4f5d-b1ba-f54719bb3c30.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S23_Ultra_-_Matte_-_Front_-_Overlay_204ac450-1f25-40cc-8ea9-b36d63366c15.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S24_Plus_-_Matte_-_Front_-_Overlay_32939e12-10a3-42ae-84f3-f08e445b12fe.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S21_-_Glossy_-_Front_-_Overlay_5ad5ab77-e1ee-49b8-baa4-14980ce7f21b.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S23_Ultra_-_Glossy_-_Front_-_Overlay_a5f4a7a7-50d4-419e-ad3e-fc516eeaaa31.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_9_Pro_XL_-_Glossy_-_Front_-_Overlay_5e0f1a05-6e7f-4b7e-a905-9a49d05cc976.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_Pro_Max_-_Glossy_-_Context_-_Overlay_549c7a4a-97e6-4b94-935a-3d455e847ab5.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_14_Plus_-_Glossy_-_Front_-_Overlay_400cacd1-42eb-4037-8c3a-df3ebe56b044.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_9_Pro_-_Glossy_-_Front_-_Overlay_523faf28-cb1c-4618-9e70-8ec99b7826e7.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_Pro_Max_-_Matte_-_Front_-_Overlay_54cca407-dfb6-495a-885b-ec19058dd62c.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_-_Matte_-_Front_-_Overlay_58a4a4ef-7955-4519-b885-38e617169625.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S24_Plus_-_Glossy_-_Front_-_Overlay_d5fe9d99-d3e1-4eab-b789-52ee0755325b.webp?v=1743383891',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_Plus_-_Glossy_-_Front_-_Overlay_03c1f5d3-3c28-414b-9336-2a16cbd27281.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S25_Ultra_-_Glossy_-_Front_-_Overlay_72120a19-5986-456e-8525-8ed630a576f5.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_6_-_Glossy_-_Front_-_Overlay_0a4b83ae-3fc9-4142-951e-d8a7ba0a51f5.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_Pro_Max_-_Matte_-_Front_-_Overlay_f96aa053-513d-406d-80c2-855a5cc10ee7.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_Pro_-_Glossy_-_Front_-_Overlay_b9c53ab4-4281-4c7f-82fe-e3771bd2b4f0.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_8_Pro_-_Glossy_-_Front_-_Overlay_c762d2e1-ab76-44e0-877f-5e1ea948c027.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_Pro_-_Glossy_-_Front_-_Overlay_a8c48bc7-afb1-459a-a844-4d62037b3d70.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S25_Plus_-_Glossy_-_Front_-_Overlay_e303192d-dd8c-46ef-9565-e14f57c9c0e4.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_9_Pro_-_Matte_-_Front_-_Overlay_9aa8c76c-8174-4e92-b5e0-cc8c197070b4.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_15_Pro_-_Matte_-_Front_-_Overlay_44ff22d9-6e92-4e03-9d99-1d0e6a440cc4.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_9_-_Matte_-_Front_-_Overlay_1318b905-0e77-42b0-b44b-b04502c15557.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S24_Ultra_-_Matte_-_Front_-_Overlay_0cbfbfd4-3665-4d0c-897e-7c48bf4bd7e1.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_8_Pro_-_Matte_-_Front_-_Overlay_5b00f9c4-fad6-4241-b285-34e440b8b733.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_9_-_Glossy_-_Front_-_Overlay_953c9764-2f2e-4580-86bd-adf034ded3e1.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S24_-_Glossy_-_Front_-_Overlay_d3f96533-3a30-4f31-b5b0-2e790020e7ac.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_Plus_-_Matte_-_Front_-_Overlay_c5767f39-a344-440d-a775-960b422886e6.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_-_Glossy_-_Front_-_Overlay_08be6ab7-6c49-46c8-934b-fb0ebe45cab0.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S24_Ultra_-_Glossy_-_Front_-_Overlay_62d3be8a-c740-4d48-a76a-50e4e6e0b12d.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_9_Pro_XL_-_Matte_-_Front_-_Overlay_7e4dbece-6b81-4ab9-bfa4-13a13b8d50f3.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_6_Pro_-_Glossy_-_Front_-_Overlay_737e933e-a6f8-4600-ac79-3d9fb44c5207.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_6_-_Matte_-_Front_-_Overlay_ed3c1a8b-67fb-4831-b361-2626702eab90.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_Pro_-_Matte_-_Front_-_Overlay_a0ed7960-1351-4dca-91db-51dd5d104e15.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_8_-_Matte_-_Front_-_Overlay_7f6f6667-b622-4af4-a370-4ddbd357e6af.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_8_-_Glossy_-_Front_-_Overlay_8f198c13-bd21-45b0-b540-b6cd6f168450.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_-_Glossy_-_Context_-_Overlay_b1874331-f944-4d47-88f6-c68d7d95b90d.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_6_Pro_-_Matte_-_Front_-_Overlay_aa5a1121-6be8-41f2-8ca0-d668b53af9f4.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Samsung_Galaxy_S25_Plus_-_Matte_-_Front_-_Overlay_ee939df0-7eca-41a8-9e7f-ecc20e0e730c.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_Pro_-_Glossy_-_Context_-_Overlay_759e6a1e-35f2-498f-8781-188beaff14a7.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_iPhone_16_Pro_Max_-_Glossy_-_Front_-_Overlay_d92c8a64-6ec0-43e2-96a1-49e3823e698e.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_5_5G_-_Matte_-_Front_-_Overlay_9411be93-21ed-466c-869d-71ae4718f6f1.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Tough_Cases_-_Google_Pixel_7_-_Matte_-_Front_-_Overlay_024a3213-6033-4626-ad10-17e4f1d1a1c3.webp?v=1743383890',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Mini_Clutch_Bag_-_Context_2_-_Overlay_50132d3c-59a1-4082-b5bd-79b9a94b2f78.webp?v=1743383889',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_Mini_-_Glossy_-_Context_-_Overlay_ce28a17d-a736-4932-a29b-89a398af7f8b.webp?v=1743383889',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_-_Matte_-_Context_-_Overlay_948e3fe9-ceb7-49df-a153-0e1116ffa2c9.webp?v=1743383888',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_Pro_-_Matte_-_Context_-_Overlay_7ccd8465-47c7-4e99-bea7-969d9b8b7fb7.webp?v=1743383889',
      width: 2048,
      height: 2048,
    },
  },
  {
    image: {
      url: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Magnetic_Tough_Cases_-_iPhone_13_Mini_-_Matte_-_Context_-_Overlay_cb3de385-bced-47e0-969e-d3bd75b2ae36.webp?v=1743383889',
      width: 2048,
      height: 2048,
    },
  },
]
  .map((overlay: any) => {
    overlay.alt = overlay.image.url
      .split('?')[0]
      .split('/')
      .pop()
      .replace(/(_-)*_Overlay[^.]*\.webp/, '')
      .replace(/men_s_/g, "men's ")
      .replace(/Cut_Sew/g, 'Cut & Sew')
      .replace(/_AOP_/g, ' (AOP) ')
      .replace(/([^-])_Front/g, '$1 - Front')
      .replace(/_+/g, ' ')

    return overlay
  })
  .sort((a, b) => (a.alt < b.alt ? -1 : a.alt > b.alt ? 1 : 0))
  .map(overlay => {
    const alias = overlay.alt.toLowerCase().replace(/\W+/g, '_')

    let tags = overlay.alt
      .toLowerCase()
      .split(' - ')
      .reduce((_tags: string[], tag: string) => {
        _tags.push(tag)

        if (tag.indexOf(' ') > -1) {
          function getWordCombination(tag: string) {
            const words = tag.split(' ')

            for (let i = 0; i < words.length; i++) {
              const _words = []

              for (let j = 0; j < words.length; j++) {
                if (words[j] !== words[i]) {
                  _tags.push(words[j])
                  _words.push(words[j])
                }
              }

              _tags.push(_words.join(' '))

              if (_words.length > 2) {
                getWordCombination(_words.join(' '))
              }
            }
          }

          getWordCombination(tag)
        }

        if (_tags.includes('tee')) {
          _tags = _tags.concat(['tshirt', 't-shirt', 't shirt', 'tshirts', 't-shirts', 't shirts'])
        }

        return Array.from(new Set(_tags)).filter(tag => tag.length > 1 && !tag.match(/^\d+$/))
      }, [])

    tags = tags.reduce((_tags: string[], tag: string) => {
      _tags.push(tag)

      if (tag.match(/ies$/)) {
        _tags.push(tag.replace(/ies$/, 'y'))
      } else if (tag.match(/es$/)) {
        _tags.push(tag.replace(/es$/, 'e'))
      }

      return _tags
    }, [])

    tags.sort((a: string, b: string) => (a.length < b.length ? 1 : a.length > b.length ? -1 : 0))

    return {
      type: 'overlay',
      shopDomain: '*',
      tags,
      alias,
      refId: alias,
      metadata: null,
      name: overlay.alt,
      width: overlay.image.width,
      height: overlay.image.height,
      previewUrl: overlay.image.url,
    }
  })

export default overlays
