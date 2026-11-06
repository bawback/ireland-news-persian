import mido, sys
from mido import Message, MidiFile, MidiTrack, MetaMessage
BPM=128; TPB=480
def note(n):
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    base=names[n[0]]; i=1
    if n[i:i+1]=='b': base-=1; i+=1
    elif n[i:i+1]=='#': base+=1; i+=1
    return 12*(int(n[i:])+1)+base
def build(kind):
    ev=[]  # (tick, msg)
    def add(ch,prog=None): pass
    def play(ch,start,dur,notes,vel):
        for n in notes:
            ev.append((int(start*TPB),Message('note_on',channel=ch,note=note(n) if isinstance(n,str) else n,velocity=vel)))
            ev.append((int((start+dur)*TPB),Message('note_off',channel=ch,note=note(n) if isinstance(n,str) else n,velocity=0)))
    progs={0:48,1:61,2:47,3:78,4:46,5:33,6:49}  # strings, brass, timpani, whistle, harp, bass, slow strings
    for ch,p in progs.items(): ev.append((0,Message('program_change',channel=ch,program=p)))
    ev.append((0,Message('control_change',channel=3,control=91,value=60)))
    if kind=='intro':
        chords=[['D3','A3','D4','F4'],['Bb2','F3','Bb3','D4'],['C3','G3','C4','E4'],['D3','A3','D4','F#4']]
        bass=['D2','Bb1','C2','D2']
        bars=4
    else:
        chords=[['Bb2','F3','Bb3','D4'],['C3','G3','C4','E4'],['D3','A3','D4','F#4']]
        bass=['Bb1','C2','D2']
        bars=3
    for b in range(bars):
        t0=b*4; last=(b==bars-1)
        steps = 8 if last else 16
        # driving 16th pulse on strings (news urgency)
        for s in range(steps):
            acc = 92 if s%4==0 else 62
            play(0,t0+s*0.25,0.2,[chords[b][1],chords[b][2]],acc)
        play(5,t0,3.8 if not last else 2,[bass[b]],95)
        play(6,t0,4,chords[b][2:],55)
        # brass stab + timpani
        play(1,t0,0.45,chords[b][1:],100)
        play(2,t0,0.5,[bass[b].replace('1','2')],110)
        if not last: play(2,t0+3.5,0.25,['A2'],80)
    # final hit
    end=bars*4-2
    fin=chords[-1]
    play(1,end,2.6,fin[1:]+['D5'],115)
    play(6,end,3.2,fin+['A4','D5'],80)
    play(2,end,0.6,['D2'],127); play(2,end-0.25,0.2,['A2'],90)
    play(5,end,3,['D2'],100)
    play(4,end,3,['D4','F#4','A4','D5','F#5','A5'],80)
    # Irish whistle melody (D dorian / mixolydian), with a little ornament
    if kind=='intro':
        mel=[('A5',0,0.5),('D6',0.5,0.75),('C6',1.25,0.25),('A5',1.5,0.5),('G5',2,0.5),('A5',2.5,1.5),
             ('F5',4,0.5),('G5',4.5,0.25),('A5',4.75,0.25),('Bb5',5,0.5),('A5',5.5,0.5),('G5',6,0.5),('F5',6.5,1.5),
             ('E5',8,0.5),('G5',8.5,0.5),('C6',9,0.75),('B5',9.75,0.25),('C6',10,0.5),('E6',10.5,1.5),
             ('D6',12,3)]
    else:
        mel=[('F5',0,0.5),('G5',0.5,0.25),('A5',0.75,0.25),('Bb5',1,1),('A5',2,0.5),('F5',2.5,1.5),
             ('G5',4,0.5),('A5',4.5,0.5),('C6',5,1),('B5',6,0.5),('A5',6.5,1.5),
             ('A5',8,0.25),('B5',8.25,0.25),('D6',8.5,2.5)]
    for n,s,d in mel: play(3,s,d*0.95,[n],100)
    ev.sort(key=lambda x:(x[0],0 if x[1].type!='note_on' or x[1].velocity==0 else 1))
    mf=MidiFile(ticks_per_beat=TPB); tr=MidiTrack(); mf.tracks.append(tr)
    tr.append(MetaMessage('set_tempo',tempo=mido.bpm2tempo(BPM)))
    last=0
    for t,m in ev: tr.append(m.copy(time=t-last)); last=t
    mf.save(f'/tmp/claude-0/jingle/{kind}.mid')
build('intro'); build('outro')
