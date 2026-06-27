/**  
 * @description IMPORTANT: We can't get shipping address after checking out on development mode.
  So we need pass a valid address to test checkout and fulfill.
  The address should be exact and valid to interact to fulfillment as well.
*/
export const DUMMY_VALID_SHIPPING_ADDRESS = {
  first_name: 'Cường',
  address1: 'A1L2-08, 2nd floor, Ecolife Capitol, 58 To Huu, Trung Van, Nam Tu Liem, Hanoi, Vietnam',
  phone: '0983.188.699',
  city: 'HaNoi',
  zip: '130301',
  province: null,
  country: 'Vietnam',
  last_name: 'Nguyễn',
  address2: null,
  company: 'BraveBits Co., Ltd',
  name: 'Nguyễn Mạnh Cường',
  country_code: 'VN',
  province_code: null,
}
