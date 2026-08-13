export class HardwareGateway {
  constructor() {
    this.enabled = false;
  }

  async send() {
    throw new Error("Gateway fisico bloqueado: defina controlador, intertravamentos e protocolo antes de habilitar.");
  }
}
