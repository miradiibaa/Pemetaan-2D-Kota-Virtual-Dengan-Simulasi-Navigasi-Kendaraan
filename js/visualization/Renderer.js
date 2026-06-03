// Pohon taman kota, dibuat tidak berbentuk bulatan polos.
  _drawTrees({ decorations, theme }) {
    if (!decorations.trees) return;
    const { ctx } = this;
    for (const tree of decorations.trees) {
      const color = theme.treeColors[tree.colorIdx] ?? theme.treeColors[0];
      const r     = tree.radius;

      ctx.save();
      ctx.translate(tree.x, tree.y);

      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(r * 0.22, r * 0.78, r * 0.82, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6c5136';
      ctx.fillRect(-r * 0.12, -r * 0.05, r * 0.24, r * 0.95);

      ctx.fillStyle = color;
      ctx.strokeStyle = this._darken(color, 22);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.22);
      ctx.lineTo(r * 0.64, -r * 0.58);
      ctx.lineTo(r * 0.48, -r * 0.12);
      ctx.lineTo(r * 0.82, r * 0.22);
      ctx.lineTo(r * 0.18, r * 0.36);
      ctx.lineTo(0, r * 0.82);
      ctx.lineTo(-r * 0.18, r * 0.36);
      ctx.lineTo(-r * 0.82, r * 0.22);
      ctx.lineTo(-r * 0.48, -r * 0.12);
      ctx.lineTo(-r * 0.64, -r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this._lighten(color, 18);
      ctx.beginPath();
      ctx.moveTo(-r * 0.30, -r * 0.78);
      ctx.lineTo(r * 0.08, -r * 1.02);
      ctx.lineTo(r * 0.35, -r * 0.58);
      ctx.lineTo(r * 0.10, -r * 0.36);
      ctx.lineTo(-r * 0.20, -r * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // Tanaman kecil
  _drawPlants({ decorations, theme }) {
    if (!decorations.plants) return;
    const { ctx } = this;

    for (const plant of decorations.plants) {
      const color = theme.plantColors?.[plant.colorIdx] ?? '#7fd25a';
      const r = plant.radius;

      ctx.save();
      ctx.translate(plant.x, plant.y);

      ctx.strokeStyle = this._darken(color, 25);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < plant.petals; i++) {
        const a = (i / plant.petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      for (let i = 0; i < plant.petals; i++) {
        const a = (i / plant.petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.35, r * 0.18, a, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = this._lighten(color, 18);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Bangunan dengan variasi bentuk berdasarkan tipe.
  _drawBuildings({ decorations, theme }) {
    if (!decorations.buildings) return;
    const { ctx } = this;
    for (const b of decorations.buildings) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      const hw = b.w/2, hh = b.h/2;
      const type = b.type ?? b.style.type;
      const frontSide = b.frontSide ?? 1;
      const frontY = frontSide > 0 ? hh : -hh;
      const rearY = -frontY;
      const frontInset = (amount) => frontY - frontSide * amount;

      // Bayangan membuat bangunan terbaca di atas background kota.
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.roundRect(-hw+4, -hh+4, b.w, b.h, 2);
      ctx.fill();

      ctx.fillStyle   = b.style.fill;
      ctx.strokeStyle = b.style.stroke;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, b.w, b.h, 2);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = this._darken(b.style.fill, 20);
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, b.w, Math.min(5, b.h*0.25), 2);
      ctx.fill();

      if (type === 'residential' || type === 'house') {
        ctx.fillStyle = this._darken(b.style.stroke, 5);
        ctx.beginPath();
        ctx.moveTo(-hw - 2, rearY + frontSide * 2);
        ctx.lineTo(0, rearY + frontSide * Math.min(9, b.h * 0.38));
        ctx.lineTo(hw + 2, rearY + frontSide * 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(220,190,150,0.55)';
        ctx.beginPath();
        ctx.roundRect(-hw + 3, Math.min(frontInset(b.h * 0.52), frontInset(b.h * 0.34)), b.w - 6, b.h * 0.18, 1);
        ctx.fill();
        ctx.fillStyle = 'rgba(80,55,40,0.35)';
        const units = 3;
        for (let i = 1; i < units; i++) {
          ctx.fillRect(-hw + (b.w / units) * i - 0.8, -hh + 5, 1.6, b.h - 8);
        }
        for (let i = 0; i < units; i++) {
          const ux = -hw + (b.w / units) * i;
          ctx.fillStyle = '#5c3d2e';
          ctx.beginPath();
          ctx.roundRect(ux + b.w / units * 0.38, frontInset(b.h * 0.24), b.w / units * 0.22, b.h * 0.24, 1);
          ctx.fill();
          ctx.fillStyle = 'rgba(170,215,235,0.82)';
          ctx.beginPath();
          ctx.roundRect(ux + b.w / units * 0.12, frontInset(b.h * 0.58), b.w / units * 0.18, b.h * 0.14, 1);
          ctx.fill();
        }
      } else if (type === 'shop') {
        ctx.fillStyle = '#d84f4f';
        ctx.beginPath();
        ctx.roundRect(-hw, frontInset(8), b.w, 4, 1);
        ctx.fill();
        ctx.fillStyle = '#f5d56a';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(-hw + i * b.w / 3, frontInset(8), b.w / 6, 4);
        }
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(-hw + b.w * 0.10, frontInset(b.h * 0.24), b.w * 0.30, b.h * 0.24, 1);
        ctx.fill();
        ctx.fillStyle = 'rgba(245,245,220,0.92)';
        ctx.beginPath();
        ctx.roundRect(-hw + b.w * 0.48, frontInset(b.h * 0.18), b.w * 0.38, b.h * 0.18, 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(50,50,50,0.28)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-hw + b.w * 0.52, frontInset(b.h * 0.10));
        ctx.lineTo(hw - b.w * 0.12, frontInset(b.h * 0.10));
        ctx.stroke();
      } else if (type === 'supermarket' || type === 'mall' || type === 'market') {
        const label = type === 'mall' ? 'MALL' : (type === 'market' ? 'PASAR' : 'MART');
        ctx.fillStyle = '#2f4f6f';
        ctx.beginPath();
        ctx.roundRect(-hw + 3, -hh + 4, b.w - 6, b.h * 0.30, 2);
        ctx.fill();
        ctx.fillStyle = '#f8f1c0';
        ctx.font = `bold ${type === 'market' ? 7 : 8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, -hh + b.h * 0.19);
        ctx.fillStyle = type === 'market' ? '#e65f45' : '#f0c75e';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(-hw + 4 + i * (b.w - 8) / 5, -hh + b.h * 0.30, (b.w - 8) / 10, 4);
        }
        ctx.fillStyle = 'rgba(70,110,130,0.85)';
        ctx.beginPath();
        ctx.roundRect(-hw + b.w * 0.12, hh - b.h * 0.34, b.w * 0.76, b.h * 0.22, 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          const x = -hw + b.w * (0.12 + i * 0.19);
          ctx.beginPath();
          ctx.moveTo(x, hh - b.h * 0.34);
          ctx.lineTo(x, hh - b.h * 0.12);
          ctx.stroke();
        }
        if (b.commercialBlock) {
          ctx.fillStyle = 'rgba(60,65,70,0.52)';
          ctx.beginPath();
          ctx.roundRect(-hw + b.w * 0.16, hh + 2, b.w * 0.68, 7, 1.5);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 0.8;
          for (let i = 0; i < 4; i++) {
            const x = -hw + b.w * (0.22 + i * 0.14);
            ctx.beginPath();
            ctx.moveTo(x, hh + 3);
            ctx.lineTo(x + 5, hh + 8);
            ctx.stroke();
          }
        }
      } else if (type === 'office' || type === 'tower' || type === 'apt') {
        if (type === 'office') {
          ctx.fillStyle = 'rgba(35,55,75,0.55)';
          ctx.beginPath();
          ctx.roundRect(-hw + 3, -hh + 3, b.w - 6, b.h * 0.20, 2);
          ctx.fill();
        }
        if (type === 'apt') {
          ctx.fillStyle = '#57516b';
          ctx.beginPath();
          ctx.roundRect(-hw + b.w * 0.38, hh - b.h * 0.25, b.w * 0.24, b.h * 0.18, 1);
          ctx.fill();
        }
      }

      if (type === 'tower') {
        ctx.strokeStyle = this._lighten(b.style.fill, 35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(0, -hh - 8);
        ctx.stroke();
      }

      if (b.w > 12 && b.h > 10) {
        ctx.fillStyle = type === 'tower'
          ? 'rgba(200,240,255,0.80)'
          : 'rgba(180,225,255,0.70)';
        const wSize = Math.min(4, b.w*0.22);
        const wGap  = b.w / 3;
        const rowGap = Math.max(7, b.h / 4);
        for (let wy = -hh + b.h * 0.34; wy < hh - wSize - 2; wy += rowGap) {
          for (let wx = -hw + wGap*0.5; wx < hw - wSize; wx += wGap) {
            if (type === 'supermarket' && wy > hh - b.h * 0.40) continue;
            if (type === 'residential' && wy > hh - b.h * 0.35) continue;
            ctx.beginPath();
            ctx.roundRect(wx, wy, wSize, wSize, 1);
            ctx.fill();
          }
        }
      }

      if (type === 'office') {
        ctx.fillStyle = 'rgba(240,250,255,0.72)';
        for (let wy = -hh + b.h * 0.30; wy < hh - 4; wy += 8) {
          for (let wx = -hw + 5; wx < hw - 4; wx += 8) {
            ctx.beginPath();
            ctx.roundRect(wx, wy, 3.2, 4.2, 1);
            ctx.fill();
          }
        }
      }

      if (type === 'tower') {
        ctx.fillStyle = 'rgba(235,250,255,0.62)';
        for (let wy = -hh + 7; wy < hh - 6; wy += 7) {
          ctx.fillRect(-hw + b.w * 0.22, wy, b.w * 0.18, 3);
          ctx.fillRect(hw - b.w * 0.40, wy, b.w * 0.18, 3);
        }
      }

      if (b.roadAligned) {
        const stripY = frontSide > 0 ? hh - 4 : -hh;

        ctx.fillStyle = 'rgba(235,226,205,0.62)';
        ctx.beginPath();
        ctx.roundRect(-hw + 3, stripY, b.w - 6, 4, 1);
        ctx.fill();

        ctx.fillStyle = 'rgba(45,50,55,0.62)';
        const doorW = Math.max(5, Math.min(10, b.w * 0.18));
        const doorH = Math.max(4, Math.min(9, b.h * 0.18));
        ctx.beginPath();
        ctx.roundRect(-doorW / 2, frontY - frontSide * doorH, doorW, doorH, 1);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-hw + 4, frontY - frontSide * 1.5);
        ctx.lineTo(hw - 4, frontY - frontSide * 1.5);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, b.w*0.45, b.h*0.35, 2);
      ctx.fill();

      ctx.restore();
    }
  }

  _drawTrafficLights({ decorations }) {
    if (!decorations.trafficLights) return;
    const { ctx } = this;

    for (const light of decorations.trafficLights) {
      ctx.save();
      ctx.translate(light.x, light.y);
      ctx.rotate(light.angle);

      // Base kecil di trotoar, lalu lengan lampu mengarah ke persimpangan.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(-3, 3, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#202020';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.lineTo(-3, -7);
      ctx.lineTo(5, -7);
      ctx.stroke();

      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.roundRect(-6, 2, 6, 3, 1.2);
      ctx.fill();

      ctx.fillStyle = '#1b1b1b';
      ctx.strokeStyle = '#050505';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(4, -15, 7, 17, 2);
      ctx.fill();
      ctx.stroke();

      const colors = ['#e23b3b', '#f0ca38', '#42d46b'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === light.active ? colors[i] : '#353535';
        ctx.shadowColor = i === light.active ? colors[i] : 'transparent';
        ctx.shadowBlur = i === light.active ? 4 : 0;
        ctx.beginPath();
        ctx.arc(7.5, -12 + i * 5.2, 1.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  // Hewan kecil sebagai dekorasi vektor.
  _drawAnimals({ decorations, theme }) {
    if (!decorations.animals) return;
    const { ctx } = this;

    for (const animal of decorations.animals) {
      const color = theme.animalColors?.[animal.colorIdx] ?? '#f2d19b';
      const r = animal.radius;

      ctx.save();
      ctx.translate(animal.x, animal.y);
      ctx.rotate(animal.angle);

      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(1, r * 0.45, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.strokeStyle = this._darken(color, 35);
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.85, r * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(r * 0.68, -r * 0.10, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r * 0.58, -r * 0.42);
      ctx.lineTo(r * 0.72, -r * 0.82);
      ctx.lineTo(r * 0.88, -r * 0.40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (animal.type === 'dog') {
        ctx.strokeStyle = this._darken(color, 30);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, -r * 0.06);
        ctx.quadraticCurveTo(-r * 1.08, -r * 0.55, -r * 1.25, -r * 0.10);
        ctx.stroke();
      } else {
        ctx.strokeStyle = this._darken(color, 40);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, 0);
        ctx.quadraticCurveTo(-r * 1.15, r * 0.28, -r * 1.25, -r * 0.24);
        ctx.stroke();
      }

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(r * 0.82, -r * 0.18, r * 0.06, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }