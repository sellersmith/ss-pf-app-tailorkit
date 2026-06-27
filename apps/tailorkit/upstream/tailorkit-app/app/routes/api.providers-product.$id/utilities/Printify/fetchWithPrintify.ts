export const fetchWithPrintify = async (url: string, apiToken: string) => {
  try {
    const data: any = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      mode: 'no-cors',
    })
      .then(res => res.json())
      .catch(err => {
        console.log('Failed to fetch Printify data ', err)
        return null
      })
    return data
  } catch (err) {
    console.log('fetchWithPrintify: Failed to fetch Printify data ', err)
    return null
  }
}
