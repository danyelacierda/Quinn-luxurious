export const formatPHP = (amount: number) => 
  new Intl.NumberFormat("en-PH", { 
    style: "currency", 
    currency: "PHP", 
    maximumFractionDigits: 0 
  }).format(amount);
