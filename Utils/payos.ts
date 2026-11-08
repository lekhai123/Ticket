import axios from "axios";
import crypto from "crypto";

export class PayOS {
  private clientId: string;
  private apiKey: string;
  private checksumKey: string;

  constructor() {
    this.clientId = process.env.PAYOS_CLIENT_ID!;
    this.apiKey = process.env.PAYOS_API_KEY!;
    this.checksumKey = process.env.PAYOS_CHECKSUM_KEY!;
  }

  private sortObjDataByKey(object: any) {
    return Object.keys(object)
      .sort()
      .reduce((obj: any, key) => {
        obj[key] = object[key];
        return obj;
      }, {});
  }

  private convertObjToQueryStr(object: any) {
    return Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .map((key) => {
        let value = object[key];
        if (value && Array.isArray(value)) {
          value = JSON.stringify(
            value.map((val) => this.sortObjDataByKey(val)),
          );
        }
        if ([null, undefined, "undefined", "null"].includes(value)) {
          value = "";
        }
        return `${key}=${value}`;
      })
      .join("&");
  }

  public createSignature(data: any) {
    const sortedData = this.sortObjDataByKey(data);
    const dataQueryStr = this.convertObjToQueryStr(sortedData);
    return crypto
      .createHmac("sha256", this.checksumKey)
      .update(dataQueryStr)
      .digest("hex");
  }

  public async createPaymentLink(data: any) {
    const signData = {
      amount: data.amount,
      cancelUrl: data.cancelUrl,
      description: data.description,
      orderCode: data.orderCode,
      returnUrl: data.returnUrl,
    };
    const signature = this.createSignature(signData);

    try {
      const res = await axios.post(
        "https://api-merchant.payos.vn/v2/payment-requests",
        { ...data, signature },
        {
          headers: {
            "x-client-id": this.clientId,
            "x-api-key": this.apiKey,
          },
        },
      );
      if (res.data.code === "00") return res.data.data;
      throw new Error(res.data.desc);
    } catch (err: any) {
      throw new Error(err.response?.data?.desc || err.message);
    }
  }

  public verifyWebhookData(webhookBody: any) {
    const { data, signature } = webhookBody;
    if (!data || !signature) return false;
    const mySignature = this.createSignature(data);
    return mySignature === signature;
  }
}

export const payosInstance = new PayOS();
