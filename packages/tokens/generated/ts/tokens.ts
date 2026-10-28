// Generated from packages/tokens/tokens.json. Do not edit.
// Run the @rivr/tokens build script after changing tokens.json.


/** Every design value, resolved. Dimensions in px are numbers. */
export const tokens = {
  "color": {
    "green": "#0E3B2C",
    "greenBlack": "#0A2A20",
    "cream": "#F3EDE0",
    "gold": "#C9A85C",
    "red": "#C4162A",
    "ink": "#141414",
    "inkMuted": "#141414B3",
    "muted": "#F3EDE099",
    "hairline": "#C9A85C40",
    "surface": "#0E3B2C",
    "raised": "#0A2A20",
    "content": "#F3EDE0",
    "contentMuted": "#F3EDE099",
    "onCream": "#141414",
    "action": "#C9A85C",
    "onAction": "#0A2A20",
    "accent": "#C9A85C",
    "money": "#C9A85C",
    "alert": "#C4162A",
    "onAlert": "#F3EDE0",
    "focus": "#F3EDE0",
    "chart": {
      "1": "#C9A85C",
      "2": "#F3EDE0",
      "3": "#7FC8A9",
      "4": "#8DB8E0",
      "5": "#E88B7D",
      "6": "#B9A4D8"
    }
  },
  "font": {
    "family": {
      "display": [
        "Bodoni Moda",
        "Tiro Devanagari Hindi",
        "serif"
      ],
      "text": [
        "Instrument Sans",
        "Noto Sans Devanagari",
        "sans-serif"
      ]
    },
    "size": {
      "12": 12,
      "13": 13,
      "14": 14,
      "16": 16,
      "18": 18,
      "20": 20,
      "24": 24,
      "28": 28,
      "36": 36,
      "44": 44,
      "48": 48,
      "56": 56,
      "88": 88,
      "96": 96,
      "280": 280
    },
    "weight": {
      "regular": 400,
      "medium": 500,
      "semibold": 600
    },
    "lineHeight": {
      "tight": 1.1,
      "snug": 1.3,
      "normal": 1.5
    },
    "letterSpacing": {
      "normal": "0em",
      "wide": "0.06em",
      "tv": "0.2em",
      "code": "0.5em"
    },
    "figures": {
      "numeric": "tabular-nums"
    }
  },
  "space": {
    "0": 0,
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64,
    "20": 80,
    "24": 96,
    "32": 128
  },
  "size": {
    "touch": 44,
    "rail": 248,
    "bottomNav": 64,
    "header": 56,
    "text": 640,
    "photo": 160,
    "card": 342,
    "receipt": 576,
    "chart": 192,
    "shareCard": 1080
  },
  "print": {
    "receiptScale": 0.4729
  },
  "aspect": {
    "portrait": "3 / 4",
    "photo": "4 / 3",
    "story": "9 / 16",
    "card": "85.6 / 54"
  },
  "radius": {
    "sm": 3,
    "md": 4,
    "lg": 6
  },
  "border": {
    "width": {
      "hairline": 1,
      "focus": 2
    }
  },
  "shadow": {
    "modal": {
      "color": "#00000080",
      "offsetX": "0px",
      "offsetY": "16px",
      "blur": "48px",
      "spread": "0px"
    }
  },
  "opacity": {
    "muted": 0.6,
    "hairline": 0.25,
    "disabled": 0.4
  },
  "z": {
    "base": 0,
    "raised": 10,
    "nav": 20,
    "banner": 30,
    "overlay": 40,
    "modal": 50,
    "toast": 60
  },
  "viewport": {
    "phone": {
      "width": 390,
      "height": 844
    },
    "tablet": {
      "width": 1180,
      "height": 820
    },
    "portrait": {
      "width": 768,
      "height": 1024
    },
    "console": {
      "width": 1440,
      "height": 900
    },
    "tv": {
      "width": 1920,
      "height": 1080
    },
    "feed": {
      "width": 1080,
      "height": 1350
    },
    "story": {
      "width": 1080,
      "height": 1920
    },
    "card": {
      "width": 342,
      "height": 216
    },
    "a4": {
      "width": 794,
      "height": 1123
    }
  },
  "brand": {
    "icon": 96,
    "maskable": 112,
    "adaptive": 140,
    "lockup": 400
  },
  "breakpoint": {
    "phone": 390,
    "medium": 768,
    "tablet": 1180,
    "console": 1440,
    "tv": 1920
  },
  "motion": {
    "duration": {
      "state": "200ms",
      "stagger": "120ms"
    },
    "easing": {
      "out": [
        0,
        0,
        0.58,
        1
      ]
    }
  },
  "icon": {
    "size": {
      "sm": 16,
      "md": 20,
      "lg": 24,
      "xl": 32
    },
    "stroke": 1.5
  }
} as const;

/** Chart series colours in order; each reads on green. */
export const chartPalette = ["#C9A85C","#F3EDE0","#7FC8A9","#8DB8E0","#E88B7D","#B9A4D8"] as const;
