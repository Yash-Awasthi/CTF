/**
 * The investigator's case log: one entry per solved slot, shown on the home page
 * and on the solved challenge page. Read in order it retells the case, so each
 * entry states what the find meant and leans toward the next one. Entries are only
 * shown after their slot is solved.
 */
export const CASEBOOK: Readonly<Record<number, string>> = {
	1: 'Case 71-C accepted. Eleven years cold, and the file is thinner than a missing person deserves.',
	2: "The rendered record leaves an item out. EVD-71C-017 is Mira's own notebook, withheld from the file she vanished from.",
	3: 'Her notebook ends in ink faded almost to nothing: "If anything happens — send to" an address in Pembridge.',
	4: 'The address leads to an 1889 deed. Josiah Marrow, dollmaker, died without an heir. The registry still lists a missing child among the persons on record.',
	5: 'A heritage page nobody was meant to find: Ashwick Figureworks, likenesses "of a peculiar fidelity". A constable named Grieve asked questions in 1889, then the record stops.',
	6: 'The directory entry removed in 2014 names Augustus Vale as a commission client. The Vales were buying Marrow\'s work a century before Silas.',
	7: 'A group photograph whose caption says six. I counted seven. Its metadata points to Sovereign Auction House.',
	8: "Lot 47's origin is dated to Marrow's lifetime, decades before the man who sold it was born, and it was kept off the public catalogue.",
	9: 'The inventory file is bigger than its manifest says. The extra bytes are Lot 47: Doll #6, a Marrow commission.',
	10: 'Doll #6 has a face, and it belongs to a woman who went missing in 1978. The register skips entry 071, as if someone took it out.',
	11: 'The portal said VERIFIED because it was told what not to show me. The owner it hid names D. Reyes as the contact.',
	12: 'Daniel Reyes wrote before I asked and handed me his own password. He wants me reading his files.',
	13: 'The 1948 owner was only redacted on the surface: Edgar Holt. An E. Holt still keeps the Pembridge heritage site.',
	14: "Vale's own ledger dates the purchase of Lot 47 to before he was born. He called these cataloguing errors. They are not.",
	15: "Daniel's memo says he arrived in late 2013. The draft still in the page says he met Vale in 2001. I kept a copy of the memo as it read today.",
	16: 'Photograph item 8 came back with six people in it. The caption finally agrees. Nobody told me it had changed.',
	17: 'The Vale archive claims no updates since 2013. Its server says it was changed long after Mira was gone.',
	18: 'A voicemail with no voice. Whoever keyed it knows the name I found in the provenance chain. Underneath, a quieter tone spells two more words.',
	19: 'Same memo, same address, a new first paragraph, and the draft is gone. The evidence is being edited while I read it.',
	20: 'Mira saw it too: it changes when observed. In her margin, one more word in the same cipher.',
	21: 'The audit log shows an elevated overwrite of the memo at 02:41 on 3 October 2015, a fortnight before Mira vanished. User: daniel.reyes.',
	22: 'He never boarded the coach. His replacement card opened a door in the estate at the minute the file was rewritten.',
	23: 'Mira never said his name aloud. She wrote it into her tape, beside a box number, where only someone looking would see it.',
	24: 'Case closed. Daniel Reyes. Every thread agrees.',
	25: 'Three minutes after closure, a photograph: D. Reyes, the same face, decades too early. The back is stamped TC-III-W.',
	26: 'Four Daniel Reyes files, one for every cycle since 1952, the same age in every photograph. It was never a man.',
	27: "Mira's last words were written where ink can't be seen: stop looking for people, follow the names.",
	28: 'The Ledger kept every cycle. I rebuilt it from names I found myself, and one of them was mine. The row after mine was already waiting.',
	29: 'People change. Names remain. Records change. Roles remain. The investigation must continue. Initialled T. C.',
	30: 'Subject identified. The last person to read the file.',
};
