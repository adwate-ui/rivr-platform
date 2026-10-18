/**
 * Every enum in the schema, keyed by its JSON Pointer, so the conformance test
 * can name the exact place in the schema where a mirror has drifted.
 */
import {
    ACTIONS, BOARD_TAGS, CLASSIFY_PERSPECTIVES, CONFIDENCE_LEVELS, COUNT_DEAD_CARDS, COUNT_SUITS, DRAW_CLASSES,
    GAME_TEXTURES, HAND_CLASSES, ONTOLOGY_VERSIONS, PLAYER_COUNTS, POSITIONS, POSTFLOP_FACING_STATES, POT_TYPES,
    PREFLOP_FACING_STATES, PRINCIPLE_STATUSES, PROVENANCE_FORMS, PROVENANCE_KINDS, RELATIVE_STRENGTHS, RUNOUT_TAGS,
    SIZING_BUCKETS, SOURCE_KINDS, SOURCE_STATES, SPR_BRACKETS, STACK_BRACKETS, STAKES, STREETS, VILLAIN_ARCHETYPES,
    VILLAIN_RAISE_SIZES,
} from './vocabulary.ts';

export const ONTOLOGY_ENUMS: Readonly<Record<string, readonly string[]>> = {
    '#/$defs/position': POSITIONS,
    '#/$defs/street': STREETS,
    '#/$defs/pot_type': POT_TYPES,
    '#/$defs/player_count': PLAYER_COUNTS,
    '#/$defs/stack_bracket': STACK_BRACKETS,
    '#/$defs/villain_raise_size': VILLAIN_RAISE_SIZES,
    '#/$defs/sizing_bucket': SIZING_BUCKETS,
    '#/$defs/action': ACTIONS,
    '#/$defs/preflop_facing_state': PREFLOP_FACING_STATES,
    '#/$defs/postflop_facing_state': POSTFLOP_FACING_STATES,
    '#/$defs/villain_archetype': VILLAIN_ARCHETYPES,
    '#/$defs/board_tag': BOARD_TAGS,
    '#/$defs/hand_class': HAND_CLASSES,
    '#/$defs/draw_class': DRAW_CLASSES,
    '#/$defs/relative_strength': RELATIVE_STRENGTHS,
    '#/$defs/runout_tag': RUNOUT_TAGS,
    '#/$defs/modifier/properties/when/properties/game_texture': GAME_TEXTURES,
    '#/$defs/quiz_hand/properties/situation_instance/properties/game_texture': GAME_TEXTURES,
    '#/$defs/principle/properties/confidence': CONFIDENCE_LEVELS,
    '#/$defs/principle/properties/status': PRINCIPLE_STATUSES,
    '#/$defs/source/properties/kind': SOURCE_KINDS,
    '#/$defs/source/properties/state': SOURCE_STATES,
    '#/$defs/stakes': STAKES,
    '#/$defs/spr_bracket': SPR_BRACKETS,
    '#/$defs/classify_rule/properties/perspective': CLASSIFY_PERSPECTIVES,
    '#/$defs/count_rule/properties/dead_cards': COUNT_DEAD_CARDS,
    '#/$defs/count_filter/oneOf/4/properties/suit': COUNT_SUITS,
    '#/$defs/quiz_hand/properties/provenance/properties/kind': PROVENANCE_KINDS,
    '#/$defs/quiz_hand/properties/provenance/properties/form': PROVENANCE_FORMS,
    '#/properties/ontology_version': ONTOLOGY_VERSIONS,
};
