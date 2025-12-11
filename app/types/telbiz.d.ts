declare module "telbiz" {
  export default class Telbiz {
    constructor(clientId: string, secretKey: string);

    SendSMSAsync(
      type: string,
      phoneNumber: string,
      message: string
    ): Promise<any>;
  }
}
