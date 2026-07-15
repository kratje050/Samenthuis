let activeActor = { id: 'device', name: 'Dit apparaat' };

export function setActiveActor(actor = {}) {
  activeActor = { id: actor.id || 'device', name: actor.name || 'Dit apparaat' };
}

export function getActiveActor() { return { ...activeActor }; }
