"""Reproduce the fictional second source used by the bounded M66 upload demo."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter

target = Path('output/pdf/neuvetra-m66-synthetic-electricity-bill-b.pdf')
c = canvas.Canvas(str(target), pagesize=letter, invariant=1, pageCompression=1)
c.setTitle('Synthetic January electricity statement - document B')
c.setAuthor('Neuvetra synthetic fixtures')
c.setFillColor(HexColor('#163b2d')); c.rect(0, 654, 612, 138, fill=1, stroke=0)
c.setFillColor(HexColor('#ffffff')); c.setFont('Helvetica-Bold', 21)
c.drawString(42, 744, 'SYNTHETIC GOLDEN STATE ELECTRIC')
c.setFont('Helvetica', 13); c.drawString(42, 717, 'January electricity statement / Document B')
c.setFont('Helvetica-Bold', 10); c.drawString(42, 686, 'FICTIONAL DEVELOPMENT FIXTURE - NOT A REAL UTILITY BILL')
c.setFillColor(HexColor('#19372b'))
def line(y, label, value):
    c.setFont('Helvetica-Bold', 10); c.drawString(42, y, label)
    c.setFont('Helvetica', 12); c.drawString(42, y-20, value)
line(612, 'SERVICE FOR', 'Synthetic California office')
line(550, 'SERVICE ADDRESS', '100 Example Way, Oakland, CA 94607')
line(488, 'ACCOUNT / BILL NUMBER', 'SYNTHETIC-0001 / SYN-CA-2023-01-B')
line(426, 'SERVICE PERIOD', 'January 1 - January 31, 2023')
c.setFillColor(HexColor('#eef5ed')); c.rect(42, 286, 528, 91, fill=1, stroke=0)
c.setFillColor(HexColor('#19372b')); c.setFont('Helvetica-Bold', 11); c.drawString(58, 351, 'METERED ELECTRICITY')
c.setFont('Helvetica-Bold', 29); c.drawString(58, 307, '12,345 kWh')
c.setFont('Helvetica', 11)
for y,text in [(248,'Statement date: February 6, 2023'),(213,'This alternate fictional document states the same consumption as fixture A.'),(195,'It supports testing a source replacement without changing the entered quantity.'),(160,'All names, identifiers, addresses and usage here are synthetic test data.'),(142,'This document provides no customer evidence, filing approval or assurance.')]:
    c.drawString(42,y,text)
c.setStrokeColor(HexColor('#a9bcad'));c.line(42,97,570,97)
c.setFont('Helvetica',9);c.drawString(42,77,'Neuvetra M66 synthetic source fixture B');c.drawRightString(570,77,'Page 1 of 1')
c.showPage();c.save()
print(target)
