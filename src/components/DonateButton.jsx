
import React, { useState, useEffect } from 'react';

const DonateButton = () => {
  const [paymentType, setPaymentType] = useState('kofi'); // Default a Ko-fi por seguridad

  useEffect(() => {
    // Detectamos la ubicación del usuario
    fetch('https://ipapi.co/json/')
      .then((response) => response.json())
      .then((data) => {
        if (data.country_code === 'AR') {
          setPaymentType('mercadopago');
        }
      })
      .catch(() => {
        console.log("No se pudo detectar ubicación, usamos Ko-fi por defecto");
      });
  }, []);

  const donateLinks = {
    mercadopago: {
      url: "link.mercadopago.com.ar/vrmstudiopro", // Genera esto en tu panel de Mercado Pago
      text: "☕ Donar con Mercado Pago",
      style: "bg-blue-500" // Estilo para MP
    },
    kofi: {
      url: "https://ko-fi.com/francomr", // Tu link de Ko-fi
      text: "☕ Support me on Ko-fi",
      style: "bg-orange-500" // Estilo para Ko-fi
    }
  };

  return (
    <a 
      href={donateLinks[paymentType].url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`px-4 py-2 rounded-lg text-white font-bold transition-all ${donateLinks[paymentType].style}`}
    >
      {donateLinks[paymentType].text}
    </a>
  );
};

export default DonateButton;
