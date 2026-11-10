import net from "node:net";
import { Client } from "ssh2";

export interface SmtpTunnelConfig {
  sshHost: string;
  sshPort?: number;
  sshUser: string;
  sshPass: string;
  remoteHost: string;
  remotePort: number;
}

export class SmtpTunnelService {
  private localServer: net.Server | null = null;
  private localPort = 0;
  private sshClient: Client | null = null;
  private isConnecting = false;
  private isReady = false;

  async ensureTunnel(config: SmtpTunnelConfig): Promise<{ host: string; port: number }> {
    if (this.isReady && this.localPort > 0) {
      return { host: "127.0.0.1", port: this.localPort };
    }

    if (this.isConnecting) {
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (this.isReady && this.localPort > 0) {
          return { host: "127.0.0.1", port: this.localPort };
        }
      }
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      const conn = new Client();
      this.sshClient = conn;

      conn.on("ready", () => {
        const server = net.createServer((socket) => {
          conn.forwardOut(
            socket.remoteAddress || "127.0.0.1",
            socket.remotePort || 0,
            config.remoteHost,
            config.remotePort,
            (err, stream) => {
              if (err) {
                console.error("[SmtpTunnel] forwardOut error:", err.message);
                socket.destroy();
                return;
              }
              socket.pipe(stream);
              stream.pipe(socket);
            },
          );
        });

        server.listen(0, "127.0.0.1", () => {
          const addr = server.address() as net.AddressInfo;
          this.localPort = addr.port;
          this.localServer = server;
          this.isReady = true;
          this.isConnecting = false;
          console.info(
            `[SmtpTunnel] SSH Relay tunnel connected to ${config.sshHost} -> ${config.remoteHost}:${config.remotePort} on local port ${this.localPort}`,
          );
          resolve({ host: "127.0.0.1", port: this.localPort });
        });

        server.on("error", (err) => {
          this.isConnecting = false;
          reject(err);
        });
      });

      conn.on("error", (err) => {
        this.isReady = false;
        this.isConnecting = false;
        console.error("[SmtpTunnel] SSH connection error:", err.message);
        reject(err);
      });

      conn.on("close", () => {
        this.isReady = false;
      });

      conn.connect({
        host: config.sshHost,
        port: config.sshPort || 22,
        username: config.sshUser,
        password: config.sshPass,
        keepaliveInterval: 15000,
        readyTimeout: 10000,
      });
    });
  }

  close(): void {
    if (this.localServer) {
      this.localServer.close();
      this.localServer = null;
    }
    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient = null;
    }
    this.isReady = false;
  }
}

export const smtpTunnelService = new SmtpTunnelService();
