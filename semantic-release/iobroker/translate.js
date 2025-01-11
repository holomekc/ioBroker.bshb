import axios from "axios";
import * as qs from "querystring";

const url = "https://translator.iobroker.in/translator";

/** Takes an english text and translates it into multiple languages */
export async function translateText(textEN) {
  const data = qs.stringify({
    text: textEN,
    together: true,
  });

  const response = await axios({
    method: "post",
    url,
    data,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  });

  return response.data;
}
